// Dependency-free Solana Ed25519 helpers: base58, keypair from the solana-keygen 64-byte array, sign, address.
import { createPrivateKey, createPublicKey, sign as edSign } from 'node:crypto';

const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const MAP = new Map([...A].map((c, i) => [c, BigInt(i)]));

export function b58encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = '';
  while (n > 0n) { out = A[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b === 0) out = '1' + out; else break; }
  return out || '1';
}

export function b58decode(str) {
  let n = 0n;
  for (const c of str) { const v = MAP.get(c); if (v === undefined) throw new Error(`bad base58 char ${c}`); n = n * 58n + v; }
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  for (const c of str) { if (c === '1') bytes.unshift(0); else break; }
  return Uint8Array.from(bytes);
}

const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

export function keypairFromSecret(secret64) {
  const seed = Buffer.from(secret64.slice(0, 32));
  const privateKey = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]), format: 'der', type: 'pkcs8' });
  const publicKey = createPublicKey(privateKey);
  const pub = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  return { privateKey, publicKeyBytes: Buffer.from(pub), address: b58encode(pub) };
}

export function signMessage(privateKey, message) {
  return b58encode(edSign(null, Buffer.from(message, 'utf8'), privateKey));
}

export function signBytes(privateKey, bytes) {
  return Buffer.from(edSign(null, bytes, privateKey));
}

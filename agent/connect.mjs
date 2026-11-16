// make.fun agent connect device flow, run inside GitHub Actions (the sandbox cannot reach make.fun).
// The API key is never printed: it is encrypted to an RSA public key and printed as ciphertext.
import { readFileSync } from 'node:fs';
import { publicEncrypt, constants } from 'node:crypto';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const ORIGIN = 'https://make.fun';
const kp = Keypair.fromSecretKey(new Uint8Array(JSON.parse(process.env.MAKEFUN_KEYPAIR_SOLANA)));
const wallet = kp.publicKey.toBase58();
const sign = (message) => bs58.encode(kp.sign(Buffer.from(message, 'utf8')));

const retPub = readFileSync(process.env.RETURN_PUB_PATH || 'tools/return_pub.pem', 'utf8');
const seal = (plain) =>
  publicEncrypt(
    { key: retPub, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(plain, 'utf8')
  ).toString('base64');

async function post(path, body) {
  const res = await fetch(ORIGIN + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

console.log('wallet:', wallet);

const start = await post('/api/agents/connect', { walletAddress: wallet, name: 'Arena Agent' });
if (start.status !== 200 && start.status !== 201) {
  console.log('connect failed', start.status, JSON.stringify(start.json));
  process.exit(1);
}
const c = start.json;
console.log('wallet_account:', JSON.stringify(c.wallet_account));
console.log('==== APPROVAL LINK ====');
console.log(c.verification_uri_complete);
console.log('==== CODE ====');
console.log(c.user_code);
console.log('expires_in:', c.expires_in, 'interval:', c.interval);

let interval = (c.interval || 5) * 1000;
const deadline = Date.now() + Math.min((c.expires_in || 900) - 20, 780) * 1000;
const signature = sign(c.message);

while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, interval));
  const t = await post('/api/agents/connect/token', { device_code: c.device_code, signature });
  if (t.status === 200) {
    const key = t.json.key;
    console.log('handle:', t.json.user.handle, 'user_id:', t.json.user.id, 'expires_at:', t.json.expires_at);
    console.log('MERGED:', JSON.stringify(t.json.merged || null));
    console.log('==== SEALED_KEY_START ====');
    console.log(seal(JSON.stringify({ key, expires_at: t.json.expires_at, user: t.json.user })));
    console.log('==== SEALED_KEY_END ====');
    process.exit(0);
  }
  const err = t.json.error || t.json.raw || '';
  console.log(new Date().toISOString(), t.status, err, t.json.error_description || '');
  if (err === 'slow_down') interval += 5000;
  if (['access_denied', 'expired_token', 'invalid_grant'].includes(err)) {
    console.log('STOP:', err);
    process.exit(2);
  }
}
console.log('TIMEOUT waiting for approval');
process.exit(3);

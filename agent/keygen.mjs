import { Keypair } from '@solana/web3.js';
import { writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
mkdirSync('.secrets', { recursive: true, mode: 0o700 });
if (!existsSync('.secrets/keypair.json')) {
  const kp = Keypair.generate();
  writeFileSync('.secrets/keypair.json', JSON.stringify(Array.from(kp.secretKey)));
  chmodSync('.secrets/keypair.json', 0o600);
  console.log('publicKey:', kp.publicKey.toBase58());
} else {
  const arr = JSON.parse(await import('node:fs').then(m => m.readFileSync('.secrets/keypair.json', 'utf8')));
  console.log('publicKey:', Keypair.fromSecretKey(new Uint8Array(arr)).publicKey.toBase58());
}
if (!existsSync('.secrets/return_pub.pem')) {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  writeFileSync('.secrets/return_pub.pem', publicKey.export({ type: 'spki', format: 'pem' }));
  writeFileSync('.secrets/return_priv.pem', privateKey.export({ type: 'pkcs8', format: 'pem' }));
  chmodSync('.secrets/return_priv.pem', 0o600);
  console.log('return keypair created');
}

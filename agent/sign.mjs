import { readFileSync } from 'node:fs';
import { keypairFromSecret, signMessage } from './sol.mjs';
const kp = keypairFromSecret(JSON.parse(readFileSync('.secrets/keypair.json', 'utf8')));
const msg = process.argv[2] === '--file' ? readFileSync(process.argv[3], 'utf8') : process.argv[2];
process.stdout.write(signMessage(kp.privateKey, msg));

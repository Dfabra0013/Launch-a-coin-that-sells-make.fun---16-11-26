/**
 * make.fun bounty entry — "Launch a coin that sells make.fun".
 *
 * The coin is the entry; this program only hands in the receipt. It reads
 * LAUNCH.json from the repository the grader mounted at MAKEFUN_BOT_DIR and
 * writes the same bytes to MAKEFUN_OUTPUT_DIR, where the house reads the mint
 * and the create signature of the coin this entry launched on pump.fun.
 *
 * Standard library only, no network, no clock, no randomness: two runs of the
 * entry must write byte-identical output.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const botDir = process.env.MAKEFUN_BOT_DIR ?? process.cwd();
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(why: string): never {
  console.error(`makefun entry: ${why}`);
  process.exit(1);
}

const raw = readFileSync(join(botDir, 'LAUNCH.json'));

let launch: unknown;
try {
  launch = JSON.parse(raw.toString('utf8'));
} catch {
  fail('LAUNCH.json is not valid JSON');
}

if (launch === null || typeof launch !== 'object' || Array.isArray(launch)) {
  fail('LAUNCH.json is not a JSON object');
}

const { mint, create_signature: createSignature } = launch as {
  mint?: unknown;
  create_signature?: unknown;
};

if (typeof mint !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
  fail('LAUNCH.json names no base58 mint address');
}
if (typeof createSignature !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,88}$/.test(createSignature)) {
  fail('LAUNCH.json names no base58 create signature');
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'LAUNCH.json'), raw);

console.log(`coin handed in: mint ${mint}, create signature ${createSignature}`);

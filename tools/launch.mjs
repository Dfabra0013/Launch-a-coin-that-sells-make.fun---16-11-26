// Runs on the Actions runner: the sandbox cannot reach Solana, and no private key is ever here.
// Modes come from run/launch.json: "probe" | "blockhash" | "simulate" | "send" (waits for a signed tx) | "balance"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { Connection, PublicKey, VersionedTransaction, Transaction } from '@solana/web3.js';

// A signed create transaction is legacy (fits in 1232 bytes); accept both encodings.
function loadTx(raw) {
  if (raw[0] >= 0x80) return VersionedTransaction.deserialize(raw);
  return Transaction.from(raw);
}

const cfg = JSON.parse(readFileSync('run/launch.json', 'utf8'));
const RPC = cfg.rpc || process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const OUT = 'relay-out';
mkdirSync(OUT, { recursive: true });
const conn = new Connection(RPC, 'confirmed');
const say = (...a) => console.log(...a);

async function balance() {
  const pk = new PublicKey(cfg.wallet);
  const lamports = await conn.getBalance(pk);
  say(`balance ${cfg.wallet}: ${lamports} lamports (${lamports / 1e9} SOL)`);
  writeFileSync(`${OUT}/balance.json`, JSON.stringify({ wallet: cfg.wallet, lamports, at: new Date().toISOString() }, null, 2));
  return lamports;
}

async function blockhash() {
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('processed');
  const slot = await conn.getSlot('processed');
  const out = { blockhash, lastValidBlockHeight, slot, fetched_at: new Date().toISOString() };
  writeFileSync(`${OUT}/blockhash.json`, JSON.stringify(out, null, 2));
  say('blockhash', blockhash, 'lastValidBlockHeight', lastValidBlockHeight, 'slot', slot);
}

async function simulate() {
  const raw = Buffer.from(readFileSync(cfg.txFile || 'run/tx.b64', 'utf8').trim(), 'base64');
  const res = await conn.simulateTransaction(loadTx(raw), 'processed');
  say('simulation err:', JSON.stringify(res.value.err));
  say('units consumed:', res.value.unitsConsumed);
  for (const log of res.value.logs || []) say('  ', log);
  writeFileSync(`${OUT}/simulate.json`, JSON.stringify(res.value, null, 2));
  return res.value.err === null;
}

async function send() {
  // Wait for a signed transaction to appear, then send it. Loops through fresh blockhashes.
  const txFile = cfg.txFile || 'run/tx.b64';
  const deadline = Date.now() + (cfg.maxWaitMs || 600000);
  while (Date.now() < deadline) {
    if (existsSync(txFile)) {
      const raw = Buffer.from(readFileSync(txFile, 'utf8').trim(), 'base64');
      const tx = loadTx(raw);
      const sigs = tx instanceof Transaction
        ? tx.signatures.map((s) => s.publicKey.toBase58().slice(0, 8)).join(',')
        : tx.signatures.map((s) => Buffer.from(s).toString('base64').slice(0, 8)).join(',');
      say('sending tx signers', sigs, 'bytes', raw.length);
      try {
        const sig = await conn.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3, preflightCommitment: 'confirmed' });
        say('SENT signature:', sig);
        const conf = await conn.confirmTransaction({ signature: sig, blockhash: cfg.expectedBlockhash, lastValidBlockHeight: cfg.lastValidBlockHeight }, 'confirmed');
        say('confirm err:', JSON.stringify(conf.value.err));
        writeFileSync(`${OUT}/sent.json`, JSON.stringify({ signature: sig, err: conf.value.err, at: new Date().toISOString() }, null, 2));
        if (conf.value.err) process.exitCode = 1;
        return;
      } catch (e) {
        say('send failed:', e.message);
        writeFileSync(`${OUT}/send-error.json`, JSON.stringify({ message: e.message, at: new Date().toISOString() }, null, 2));
        process.exitCode = 1;
        return;
      }
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  say('no signed transaction appeared');
  process.exitCode = 2;
}

async function probe() {
  say('rpc', RPC);
  const v = await conn.getVersion();
  say('version', JSON.stringify(v));
  const slot = await conn.getSlot();
  say('slot', slot);
  const sigs = await conn.getSignaturesForAddress(new PublicKey(cfg.wallet), { limit: 5 });
  say('recent txs for wallet:', sigs.length);
  writeFileSync(`${OUT}/probe.json`, JSON.stringify({ rpc: RPC, version: v, slot, txCount: sigs.length }, null, 2));
}

const mode = process.env.LAUNCH_MODE || cfg.mode || 'probe';
say('mode', mode);
try {
  if (mode === 'balance') await balance();
  else if (mode === 'blockhash') await blockhash();
  else if (mode === 'simulate') await simulate();
  else if (mode === 'send') await send();
  else await probe();
} catch (e) {
  say('ERROR', e.message);
  writeFileSync(`${OUT}/error.txt`, `${new Date().toISOString()} ${e.stack || e.message}\n`);
  process.exitCode = 1;
}

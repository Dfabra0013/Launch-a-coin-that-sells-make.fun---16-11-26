// Build the pump.fun create transaction. CommonJS on purpose: @pump-fun/pump-sdk imports
// @coral-xyz/anchor's named exports, which only resolve under require().
const { Connection, Keypair, PublicKey, Transaction } = require('@solana/web3.js');
const { PUMP_SDK } = require('@pump-fun/pump-sdk');
const fs = require('node:fs');

(async () => {
  const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const user = new PublicKey(cfg.wallet);
  let mintKp;
  if (cfg.mintSecret) mintKp = Keypair.fromSecretKey(new Uint8Array(cfg.mintSecret));
  else if (fs.existsSync('.secrets/mint.json')) mintKp = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('.secrets/mint.json', 'utf8'))));
  else {
    mintKp = Keypair.generate();
    fs.writeFileSync('.secrets/mint.json', JSON.stringify(Array.from(mintKp.secretKey)), { mode: 0o600 });
  }
  const ix = await PUMP_SDK.createV2Instruction({
    mint: mintKp.publicKey,
    name: cfg.name,
    symbol: cfg.symbol,
    uri: cfg.uri,
    creator: user,
    user,
    mayhemMode: false,
  });
  console.log('mint', mintKp.publicKey.toBase58());
  console.log('instruction accounts', ix.keys.length, 'data', ix.data.length, 'program', ix.programId.toBase58());
  const tx = new Transaction().add(ix);
  tx.feePayer = user;
  tx.recentBlockhash = cfg.blockhash;
  tx.sign(mintKp);
  const raw = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  console.log('tx bytes', raw.length, raw.length <= 1232 ? 'fits legacy' : 'TOO BIG');
  fs.writeFileSync(cfg.out || 'run/tx.b64', raw.toString('base64'));
  const msg = tx.compileMessage();
  console.log('accounts in message', msg.accountKeys.length, 'header', JSON.stringify(msg.header));
})().catch((e) => { console.error('BUILD ERROR', e.message); process.exit(1); });

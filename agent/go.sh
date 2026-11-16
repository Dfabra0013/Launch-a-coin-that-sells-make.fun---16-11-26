#!/usr/bin/env bash
# Launch the coin: one command, once the wallet holds SOL.
#
# The building machine has no route to Solana, so the runner publishes a blockhash, this
# machine signs the create transaction (the key never leaves it) and the runner sends the
# bytes. A blockhash is good for about a minute, so the three legs run back to back.
set -uo pipefail
cd "$(dirname "$0")/.."

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
NAME='WANTED: The $1,000 Bounty'
SYMBOL='WANTED'
URI='https://raw.githubusercontent.com/Dfabra0013/Launch-a-coin-that-sells-make.fun---16-11-26/metadata/metadata.json'

pull() { git fetch -q origin && git merge -q --no-edit "origin/$BRANCH" >/dev/null 2>&1 || true; }
pushc() { git add -A && git commit -q -m "$1" && git push -q origin HEAD; }

waitfor() { # waitfor <path> <seconds>
  local p="$1" t="$2" i=0
  while [ ! -f "$p" ]; do
    sleep 3; i=$((i+3)); pull
    [ "$i" -ge "$t" ] && { echo "timed out waiting for $p"; return 1; }
  done
  return 0
}

wallet() { node -e "const{keypairFromSecret}=await import('./agent/sol.mjs');" 2>/dev/null; node --input-type=module -e "
import { keypairFromSecret } from './agent/sol.mjs';
import { readFileSync } from 'node:fs';
process.stdout.write(keypairFromSecret(JSON.parse(readFileSync('.secrets/keypair.json','utf8'))).address);
"; }

[ -d agent/node_modules ] || (cd agent && npm install --silent --no-fund --no-audit @solana/web3.js@1.98.4 @pump-fun/pump-sdk@4.3.1 @coral-xyz/anchor @solana/spl-token bs58 >/dev/null 2>&1)

W="$(wallet)"
echo "wallet: $W"

for attempt in 1 2 3; do
  echo "--- attempt $attempt ---"
  rm -f relay-out/blockhash.json relay-out/sent.json relay-out/send-error.json
  cat > run/launch.json <<JSON
{ "mode": "blockhash", "wallet": "$W", "wallets": ["$W"] }
JSON
  echo launch > run/task.txt
  pushc "launch: publish a blockhash (attempt $attempt)"
  waitfor relay-out/blockhash.json 120 || continue

  BH="$(node -e "const b=require('./relay-out/blockhash.json');process.stdout.write(b.blockhash)")"
  LVB="$(node -e "const b=require('./relay-out/blockhash.json');process.stdout.write(String(b.lastValidBlockHeight))")"
  echo "blockhash: $BH"

  node -e "
    const fs=require('fs');
    fs.writeFileSync('run/build.json', JSON.stringify({
      wallet: '$W', name: '$NAME', symbol: '$SYMBOL', uri: '$URI',
      blockhash: '$BH', out: 'run/tx.b64'
    }, null, 1));
  "
  node agent/build.cjs run/build.json || { echo "build failed"; exit 1; }

  cat > run/launch.json <<JSON
{ "mode": "send", "wallet": "$W", "txFile": "run/tx.b64", "expectedBlockhash": "$BH", "lastValidBlockHeight": $LVB, "maxWaitMs": 300000 }
JSON
  pushc "launch: send the signed create transaction (attempt $attempt)"

  if waitfor relay-out/sent.json 240; then
    if [ -f relay-out/send-error.json ]; then
      echo "send error:"; cat relay-out/send-error.json; continue
    fi
    echo "=== SENT ==="; cat relay-out/sent.json
    MINT="$(node -e "const b=require('./run/build.json');" 2>/dev/null; node -e "const fs=require('fs');const s=JSON.parse(fs.readFileSync('.secrets/mint.json'));process.stdout.write(require('@solana/web3.js').Keypair.fromSecretKey(new Uint8Array(s)).publicKey.toBase58())" 2>/dev/null || true)"
    exit 0
  fi
done
echo "did not land after three attempts"
exit 1

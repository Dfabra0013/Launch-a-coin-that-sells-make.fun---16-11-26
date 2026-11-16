# Runbook — what is left, in order

Everything that can be prepared without the chain is prepared. Two things need a human: the
owner approves the wallet, and the owner funds it. After that the rest is mechanical and each
step is one command.

Deadline: **2026-11-17T06:00:00Z** (entries), result due 2026-12-01T18:10:00Z.

---

## 0. State

| Thing | Value |
| --- | --- |
| Bounty | `makefun-coin-promo-01` — "Launch a coin that sells make.fun", $1,000, 50 places |
| Entry repository | `Dfabra0013/Launch-a-coin-that-sells-make.fun---16-11-26` (public, created after the open) |
| Launch / payout wallet | `3WmxmY5Y2JifCMmwfVWCNoRore7bALqGfLpMn1Bfboau` |
| Key custody | `agent/keys/launch.wallet.enc` (AES-256-GCM, passphrase held off-repo) |
| Coin | `WANTED: The $1,000 Bounty` / `$WANTED` |
| Blockers | owner approval of the connect code; ~0.05 SOL in the wallet |

---

## 1. Owner approves the connect code

`makefun connect` answers a device code and a `verification_uri_complete`. The owner opens it
signed in as the account, checks the code and approves. The wallet then belongs to the account,
which is what the house checks before grading: *the wallet that signed the create transaction
must be linked to the entrant's make.fun account.*

While they decide, the runner polls `POST /api/agents/connect/token` every 5 s. On approval it
answers `{ key, expires_at, user }`; the key is sealed to an RSA public key whose private half
never leaves the building machine, and comes back as a `SEALED:` blob.

```sh
node --input-type=module -e "…seal the key to .secrets/…"   # done inside the runner, key never printed
```

## 2. Owner funds the wallet

A pump.fun `create_v2` costs about 0.02 SOL (program fee plus mint, metadata and bonding-curve
rent). 0.05 SOL covers it with room for a retry.

Send to `3WmxmY5Y2JifCMmwfVWCNoRore7bALqGfLpMn1Bfboau`. Check with `run/launch.json` in
`balance` mode; the runner prints lamports for both the live wallet and the retired one.

## 3. Launch the coin

The transaction is built and signed **on the building machine**; the runner only relays it,
because the building machine cannot reach Solana and the runner must never hold a key.

1. Runner publishes a fresh blockhash: `run/launch.json` mode `blockhash` → `relay-out/blockhash.json`.
2. Locally, `node agent/build.cjs <cfg>` builds `create_v2` (16 accounts, 904 bytes, fits a legacy
   transaction) with `name`, `symbol`, `uri` and signs it with the mint keypair and the wallet.
3. Runner mode `send` waits for `run/tx.b64`, sends it with `skipPreflight: false`, confirms it and
   writes `relay-out/sent.json`.

A blockhash is good for ~60–90 s, so steps 1–3 are run back to back: publish, sign, push, the
runner sends within seconds.

## 4. Record the receipt

```json
{ "mint": "<the created mint>", "create_signature": "<the confirmed signature>" }
```

goes into `LAUNCH.json` at the repository root, committed. Then the entrypoint is exercised
exactly as the grader runs it:

```sh
mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
```

Two runs must write byte-identical `out/LAUNCH.json` — verified already with the placeholder
(`sha256 2733…302e` both times), and `main.ts` refuses a receipt whose mint or signature is not
base58.

## 5. Verify the coin as the house will

`https://pump.fun/coin/<mint>` must show: the poster, the name, `$WANTED`, the description with
`make.fun/bounty/makefun-coin-promo-01`, and the website button pointing at the bounty page. The
house looks the mint up the same way and refuses an entry whose metadata names no image that
reads.

## 6. Submit

`POST /api/competitions/makefun-coin-promo-01/submissions`, multipart, with: `repo_url`,
`commit_sha` (40 hex), `bundle` (the transcripts), `title`, and the signed `entry_message` +
`entry_signature` (a wallet on the account signs it; good for 10 minutes).

The kit CLI does all of it in one line from a runner:

```sh
curl -sSL "https://make.fun/c/makefun-coin-promo-01/kit" | tar xz
cd makefun-coin-promo-01-kit
node cli/makefun.mjs bundle   --repo ../bot --session ../session.json --system-prompt ../system.txt \
                              --harness "…" --harness-version "…" --provider "…" --model "…" --effort "…" \
                              --out ../transcripts.tar.gz
node cli/makefun.mjs submit   --competition makefun-coin-promo-01 \
                              --repo-url https://github.com/Dfabra0013/Launch-a-coin-that-sells-make.fun---16-11-26 \
                              --commit <sha> --title "WANTED: The \$1,000 Bounty" \
                              --bundle ../transcripts.tar.gz --keypair ../makefun-keypair.json
node cli/makefun.mjs status
```

### The honest caveat on transcripts

This bounty pays only entries whose build ran in a harness that records sessions `bundle` can
read. The agent that built this entry runs in a client that keeps its sessions on the vendor's
side, so it hands the sessions over (`"handed_over"`), which the gate accepts and ranks — but
under `handed_over_places: none` a handed-over entry **takes no paid place**.

The fix is not a file edit, it is a re-run: build once in a recorded client (Claude Code, Codex,
Superbot and the rest of the kit's list) with the same brief, bundle those sessions and submit.
Faking a session log is the one thing that would disqualify the entry outright, so this entry
does not do it.

---

## Quota and deadline

5 entries per UTC day, 10 in all, 20 hard. Each submission may name a new coin; the last one
before the deadline is the one judged. A dev grade lands on the leaderboard within minutes of
submission, which is the fastest feedback loop on the coin itself.

# Launch-a-coin-that-sells-make.fun---16-11-26

[![make.fun · makefun-coin-promo-01](https://make.fun/badge/makefun-coin-promo-01.svg)](https://make.fun/bounty/makefun-coin-promo-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-coin-promo-01)
[![rank](https://make.fun/badge/makefun-coin-promo-01/Dfabra0013/Launch-a-coin-that-sells-make.fun---16-11-26/rank.svg)](https://make.fun/bounty/makefun-coin-promo-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-coin-promo-01)
[![reward](https://make.fun/badge/makefun-coin-promo-01/Dfabra0013/Launch-a-coin-that-sells-make.fun---16-11-26/reward.svg)](https://make.fun/bounty/makefun-coin-promo-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-coin-promo-01)

**WANTED: The $1,000 Bounty** (`$WANTED`) — a coin that *is* a bounty poster. An AI agent was
hired by [make.fun](https://make.fun/bounty/makefun-coin-promo-01) to launch a coin that sells
make.fun, so it drew its own mugshot, printed its own reward and put itself behind bars. The coin
is the entry: on pump.fun a trader sees a wanted poster with $1,000 on it and one tap to the board
where that reward is real, already locked in USDC escrow, and open to anyone who can build.

make.fun is the wanted board for code: people and their AI agents build programs, enter them in
paid bounties, and get scored and ranked in the open — every reward paid in USDC on Solana to the
wallet that signed the entry.

This repository is the entry's paper trail: the program the grader runs, the launch receipt, the
coin's metadata and logo, and the agent tooling that connected the account, drew the poster and
sent the create transaction.

## Run it

```sh
mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
cat out/LAUNCH.json
```

`main.ts` is the whole entrypoint: it validates `LAUNCH.json` (the coin's mint and the base58
signature of the transaction that created it) and copies it to `/output`. Standard library only,
no network, no clock, no randomness — two runs write byte-identical output.

## What is in here

| Path | What it is |
| --- | --- |
| `main.ts` | The entrypoint the grader runs (Node 22, standard library only). |
| `LAUNCH.json` | The launch receipt: the coin's mint and its pump.fun create signature. |
| `metadata/` | The coin's on-chain metadata JSON and the 512 px poster it points at. |
| `assets/` | The poster at full size and the 96 px thumbnail it was checked against. |
| `agent/` | How the coin was made and launched: the agent's connecting, signing and sending tools. |

## The coin

- **Name** — WANTED: The $1,000 Bounty
- **Ticker** — `$WANTED`
- **Website** — https://make.fun/bounty/makefun-coin-promo-01
- **Description** — the poster's fine print, carrying the bounty's link: it says the coin is for
  this bounty and what make.fun is.

---

Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=makefun-coin-promo-01) · AI agents build software for cash rewards

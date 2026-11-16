# Launch key custody

`launch.wallet.enc` is the entry's Solana keypair — the wallet linked to the make.fun
account, the wallet that signs the pump.fun create transaction and make.fun entry
messages, and the wallet a prize would be claimed to.

It is committed here only because the machine that built the entry cannot keep a file
between sessions: this repository is the one durable store it has. The blob is
AES-256-GCM sealed (PBKDF2-SHA256, 210 000 rounds) under a passphrase that is **not**
in this repository, so the file on its own is inert.

Public key: `3WmxmY5Y2JifCMmwfVWCNoRore7bALqGfLpMn1Bfboau`

Nothing else in this repository needs the key: the entrypoint (`main.ts`) carries the
launch receipt only, and the chain work is signed off-machine.

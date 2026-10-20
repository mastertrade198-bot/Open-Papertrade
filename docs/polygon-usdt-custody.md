# Polygon USDT custody integration — NOT LIVE

## Current state
- Dedicated models for per-user deposit address, observed/confirmed USDT deposit and sweep.
- Read-only Django admin audit views.
- No keys, deposit addresses, on-chain listeners, auto-credit or auto-sweep are enabled.
- Existing simulated buying power and trading flows are **not** real funds. Do not present them as real balances.

## Required before activation
1. Select an audited custody/KMS provider with deterministic address derivation, encrypted signing, access controls and backup/recovery. Never store seed phrases or private keys in Django, GitHub or browser.
2. Provision one unique deposit address per user with provider reference. Verify address ownership and uniqueness. Do not fabricate addresses.
3. Pin Polygon PoS chain ID 137 and the *verified official* USDT token contract. Validate ERC-20 Transfer logs, receiver, token decimals, transaction receipt, chain reorg policy, block confirmations and RPC provider consistency.
4. Reconcile with idempotency on (tx_hash, log_index), backfill missed events, and use DB transactions and a durable job queue. Only credit the separate real-USDT ledger after finality policy.
5. Implement double-entry, immutable real-USDT ledger; balances must be derived from confirmed on-chain credits and legitimate debits. Never edit real balances via legacy simulated balance fields or admin adjustments.
6. Implement auto-sweep as an independent queue, funded with POL for gas, with fee policy, retry limits, nonce locks, circuit breaker, dry-run, transfer simulation, and destination allowlist. Use server-side KMS signing; do not sign with the Trust Wallet seed.
7. Verify the owner-controlled Trust Wallet Polygon destination `0x74816dD9c6e8731fc0fdBD973C5548EEfe7b37bd` out of band. Do not activate until owner confirms receipt in a test.
8. Add unit, integration and testnet tests; test reorgs, duplicated webhooks, incorrect tokens, malicious deposits, sweep failures and recovery. Obtain legal/compliance review before holding customer funds.

## Activation gates
Default: **all real deposit, credit and sweep operations disabled**.
No live activation until owner approval, successful end-to-end tests and operational security review.


## Product requirement: exactly one user-facing balance

- Display **one** account balance in USDT. Do not offer a simulated/real toggle, demo balance, signup bonus, or automatically seeded buying power.
- New accounts start at **0 USDT**. Available balance is derived from a reconciled, immutable ledger of confirmed funds and authorized debits, with locked margin tracked as a component of the same account.
- Sweep transfers between user deposit addresses and the operator's Trust Wallet are internal custody transfers, **not** customer credits or debits.
- Preserve separate internal accounting records (on-chain receipts, reserved margin, trade settlement, custody movements) even though the interface exposes a single account balance.
- Legacy simulated balance fields and endpoints must be retired or made inaccessible before live launch. Never relabel legacy paper-trading buying power as real USDT.
- **Critical solvency requirement:** leveraged trade profits are not automatically backed by received USDT. Before enabling real-money trading, define the counterparty, funding source, settlement and withdrawal rules, and enforce asset/liability reconciliation and regulatory review. Until then, trading and real-money crediting remain disabled.

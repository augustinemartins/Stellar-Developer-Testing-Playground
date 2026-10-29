---
title: Optional transaction submission with Freighter
labels: complexity: high, area: web, security
---

The playground is read-only by design. Many users want to submit a call after simulating it on testnet.

## Task

Add an opt-in **Submit with Freighter** flow: connect the wallet, show a confirmation dialog with network, contract, method, arguments, fee and required signatures, sign in Freighter and submit, then poll and show the result.

## Acceptance criteria

- Disabled on mainnet unless the user explicitly enables it in settings.
- The playground never sees a secret key; signing happens only in the wallet.
- The CSP stays strict; `docs/security.md` is updated.
- Tests with a mocked wallet API.

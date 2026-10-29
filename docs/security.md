---
title: Security and privacy
description: What the playground does and does not do with your data.
order: 11
---

# Security and privacy

## No keys, no signing

The playground only **simulates**. It never asks for, stores or uses secret keys, and it has no code that signs transactions. If you paste a secret key (`S…`) into any field, it is flagged and never sent anywhere.

**Create funded test account** generates a keypair in your browser, funds the public key with friendbot and immediately discards the secret.

## Where your data goes

- Simulation requests go **directly from your browser to the RPC URL** shown in the network selector. Choose a custom RPC to keep traffic within your own infrastructure.
- Saved scenarios, recent contracts and settings are stored in your browser's `localStorage`. Clearing site data deletes them.
- Share links put the scenario in the URL **fragment** (`#scenario=…`). Browsers do not send fragments to servers, so the hosting server never sees shared scenarios. Anyone with the link can read the scenario.
- The app makes no analytics or third-party requests. The Monaco editor is self-hosted.

## Untrusted input

Imported files and share links are untrusted:

- they are parsed as JSON and validated against the scenario schema before use;
- share links are size-limited while decompressing, so a crafted link cannot exhaust memory;
- values are rendered as text, never as HTML.

## Deployment hardening

The Next.js server sends a restrictive Content-Security-Policy (no framing, no third-party scripts, `connect-src` limited to HTTPS and localhost RPCs), `X-Content-Type-Options`, `Referrer-Policy: no-referrer` and a minimal `Permissions-Policy`.

## Sample contracts

The sample contracts are for learning and testing only. They have not been audited and must not be used to hold real value.

## Reporting a vulnerability

Please report security issues privately to the maintainers rather than opening a public issue. See `SECURITY.md` in the repository.

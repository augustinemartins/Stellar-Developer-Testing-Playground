# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead, report them privately through GitHub's [private vulnerability reporting](https://github.com/augustinemartins/Stellar-Developer-Testing-Playground/security/advisories/new).

Include steps to reproduce and the impact you expect. We aim to acknowledge reports within 3 working days and to keep you updated until the issue is fixed.

## Scope

In scope:

- the web app (for example XSS, CSP bypasses, or a crafted share link or scenario file that runs code or exhausts memory);
- the packages in `packages/`;
- the scripts in `scripts/`.

Out of scope:

- the sample contracts in `contracts/`, which are unaudited teaching examples and must not hold real value;
- vulnerabilities in Stellar networks, RPC providers or third-party dependencies (please report those upstream);
- issues that require a compromised browser or device.

## Design

The playground only simulates transactions. It never asks for, stores or uses secret keys and has no signing code. See [docs/security.md](docs/security.md) for details.

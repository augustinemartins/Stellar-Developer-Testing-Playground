---
title: VS Code extension: open contracts and scenarios in the playground
labels: complexity: high, area: tooling
---

## Task

Create a minimal VS Code extension (in `extensions/vscode`) that:

- adds **Open in Stellar Playground** for `*.scenario.json` files (via a share link) and for contract IDs under the cursor;
- validates scenario files against the JSON Schema from `@playground/shared-types`;
- has a configurable playground URL (for self-hosting).

## Acceptance criteria

- Packaged with `vsce`, with tests for the commands.
- README with screenshots; CI builds the extension.

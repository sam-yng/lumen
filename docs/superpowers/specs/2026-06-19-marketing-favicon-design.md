# Marketing favicon parity

## Goal

Give the marketing site the same favicon and platform icon treatment as the
web app.

## Design

Copy the web app's existing Next.js file-based metadata assets into
`apps/marketing/src/app/` without modifying either root layout:

- `favicon.ico` for conventional browser favicon discovery.
- `icon.svg` for scalable browser icon support.
- `apple-icon.png` for Apple touch surfaces.

The copied files remain byte-for-byte identical to the web app assets. Next.js
will discover them from the marketing App Router root and generate the required
metadata links automatically.

## Scope and verification

No new branding, dependencies, runtime logic, or metadata configuration is
needed. Verification consists of confirming file equality, running
`bun run check`, and loading the marketing site in a browser to confirm the
favicon resolves and renders.

# CLAUDE.md

## Project Overview

**Squads Public Client V4** is a React-based web client for the [Squads V4 Protocol](https://squads.so) — a multisig program on the Solana blockchain. It provides UI for managing multisig wallets: creating squads, managing members/permissions, proposing/executing transactions, managing program upgrades, and handling tokens in vaults.

The app is deployed as a static site (Hash Router) and emphasizes **verifiable/reproducible builds** — users can confirm build integrity via SHA-256 hashes or IPFS CIDs.

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React 19, TypeScript 5.8, React Router v7 (HashRouter) |
| Build | Webpack 5 (deterministic), ts-loader |
| Styling | Tailwind CSS 3, Radix UI, Lucide icons, Sonner toasts |
| State | `@tanstack/react-query` v5 (all server/blockchain state) |
| Blockchain | `@solana/web3.js`, `@sqds/multisig` v2, `@solana/wallet-adapter-react` |
| Token | `@solana/spl-token` |

---

## Repository Structure

```
src/
  index.tsx              # App entry point
  App.tsx                # Router setup
  routes/                # Page-level components (_index, create, config, transactions, programs, settings)
  components/            # Feature components + ui/ (button, card, dialog, etc.)
  hooks/                 # Custom hooks
  lib/                   # Pure utilities and transaction logic
public/                  # Static assets
scripts/                 # Build hash generation and verification scripts
webpack.{common,dev,prod}.js
```

---

## Key Patterns

### Data Fetching
- All blockchain data uses `@tanstack/react-query` with `useSuspenseQuery`
- Query keys follow the pattern: `['multisig', address]`, `['balance', vault]`
- `useServices.tsx` is the main file for query hooks

### Settings Persistence
- RPC URL, Program ID, and Explorer URL are stored in `localStorage`
- Keys: `x-rpc-url`, `x-program-id-v4`, `x-explorer-url`
- Accessed via `useSettings()` hook in `src/hooks/useSettings.tsx`

### Central State Hub
- `useMultisigData()` (`src/hooks/useMultisigData.tsx`) is the single source of truth for the active multisig address, RPC connection, program ID, and vault PDA

### Routing
- Hash-based routing (`HashRouter`) enables static site deployment without server routing
- Routes: `/`, `/create`, `/config`, `/transactions`, `/programs`, `/settings`

### Styling
- Tailwind utility-first; custom theme via CSS variables in `src/styles/global.css`
- Use `cn()` from `src/lib/utils.ts` for conditional class merging (clsx + tailwind-merge)
- Responsive: mobile-first, `md:` breakpoint for sidebar layout

### Error Handling
- `ErrorBoundary` components wrap route-level rendering
- `Suspense` wrappers used with `useSuspenseQuery`
- User feedback via Sonner toast notifications (max 3 visible)
- `invariant` for internal assertions

### TypeScript
- Strict mode enabled
- Path aliases: `@/components/*`, `@/hooks/*`, `@/lib/*`, `~/*`
- Avoid `@ts-ignore` except for SDK interop edge cases

---

## Build & Dev Commands

```bash
yarn install --frozen-lockfile   # Install deps (always use frozen)
yarn dev                         # Dev server with hot reload
yarn build                       # Production build → dist/
./scripts/generate-hash.sh       # SHA-256 hash of dist/ for verification
```

**Verification scripts:**
```bash
./scripts/verify-remote.sh <URL> <HASH>
./scripts/verify-ipfs.sh <CID> <HASH>
```

**Docker (reproducible build):**
```bash
docker build -t squads-public-v4-client .
docker run -d -p 8080:80 squads-public-v4-client
```

> No test suite is configured (`yarn test` is a no-op).

---

## Reproducible Builds

This project is configured for deterministic output — critical for security verification:
- `webpack.prod.js` uses `moduleIds: 'deterministic'` and outputs a single bundle
- `Dockerfile` sets `SOURCE_DATE_EPOCH` for consistent file timestamps
- `scripts/generate-hash.sh` hashes sorted file concatenation with SHA-256
- Build hashes are published in `HASHES.md`

Do not break determinism when modifying build config.

---

## Important Files

| File | Purpose |
|---|---|
| `src/hooks/useMultisigData.tsx` | Central multisig state (connection, address, vault PDA) |
| `src/hooks/useServices.tsx` | React Query hooks for all blockchain data |
| `src/hooks/useSettings.tsx` | localStorage-backed settings |
| `src/lib/utils.ts` | `cn()`, `renderPermissions()`, `isMember()` |
| `src/lib/createSquad.ts` | Multisig creation logic |
| `src/lib/transaction/` | Decode, import, simulate encoded transactions |
| `src/components/ui/` | Shared UI component library |
| `webpack.prod.js` | Production build config (do not break determinism) |
| `HASHES.md` | Published build hashes for user verification |

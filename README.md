# English Fluency (Angular + Tailwind CSS + DaisyUI)

A private daily 25-minute American English speaking and listening coach for a 12-week fluency plan: six practice days and one weekly story review each week. It runs entirely in the browser with no server or account, works offline via `@angular/service-worker`, and keeps all logs, transcripts, and voice recordings strictly in IndexedDB.

*(The original zero-build vanilla JS + `pwa-kit` v1.0.0 checkpoint is preserved on branch `main` at tag `v1-vanilla`.)*

## Run locally

```powershell
npm.cmd install
npm.cmd start
```

Open `http://localhost:4176`.

## Build & Test

```powershell
# Domain unit tests (72 lessons, LCS diff, L1 habit analyzer, .ics, backups)
npm.cmd test

# Production build (GitHub Pages subfolder base-href + service worker)
npm.cmd run build:pages

# Local production build (relative base-href) & full Playwright E2E + offline test
npm.cmd run build
npm.cmd run test:browser
```

## Architecture

- Built with standalone, zoneless Angular (Signals, `@if`/`@for`, hash routing), **Tailwind CSS v4 + DaisyUI v5** (system-aware Nord light / Dim dark + user-selectable presets), and shared kit primitives synced from [`angular-pwa-kit`](../angular-pwa-kit) (`src/app/kit/`).
- Preserves strict Content Security Policy (zero external network requests; `media-src 'self' blob:`) and IndexedDB compatibility (`'english-fluency'` v1: `days`, `recordings`, `kv`).

## Live App & Deployment

- **URL:** `https://rajeswarandhandapani.com/english-fluency/`
- Every push to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which runs `npm ci`, runs `npm test`, builds with `--base-href /english-fluency/`, and deploys directly via `actions/deploy-pages` (GitHub Pages **Source: GitHub Actions**, custom domain blank so it inherits `rajeswarandhandapani.com`).

# DECISIONS.md

Running log of product and build decisions. Newest at the bottom. Format: date — decision — why.
Trip planning and personal context live in the "Travel Japan" Claude Project, not in this repo.

## History before this repo (2026-10-10 → 10-12)
- 2026-10-10 — v1 built as a claude.ai artifact (stylized three.js globe, hand-drawn terrain) — artifacts can't load outside map tiles, so it could never be photoreal.
- 2026-10-12 — v2 built on CesiumJS + Google Photorealistic 3D Tiles via Cesium ion free Community plan, hosted on GitHub Pages (github.com/Tds987/japan-earth) — proved photoreal 3D works for free.
- 2026-10-12 — Google Maps Platform direct billing rejected — wanted no card on file; Cesium ion free plan stops at the quota instead of billing.
- 2026-10-12 — Rebuild from scratch — v2 looked archaic/pixelly; earlier Italy app (italia-travel.vercel.app) was too dense and hard for others to use.

## Carried-forward decisions
- Phone-first; must pass the stranger test (understood in 10 seconds).
- Google Earth feel: globe intro, fly-to, tilt into photoreal 3D.
- Bottom bar = sections (working: Map · Plan · Journal), NOT category filters. Final set: Tyler decides.
- Categories/filters live inside search as one sheet.
- Prices shown in local currency AND USD; estimates labeled.
- "Bourdain was here" flag on places he visited.
- Journal is private and stays in the app.
- Multi-region from day one: regions are data + a region pack (palette, type, motifs, currency).
- Free services only unless Tyler approves otherwise.
- Must work on weak signal (eSIM traveler).

## Known config
- Cesium ion token is URL-restricted in the Cesium dashboard; add each new domain (Vercel URL, localhost) to its allowed list.
- Free plan limits: ~1,000 Google 3D loads/month (≈1 per app open), 1,000 imagery sessions.

## Log
<!-- Claude Code: append new entries below -->
- 2026-10-16 — Moved `places.js` into `legacy/` — CLAUDE.md expects reference data at `legacy/places.js`; it stays untouched until migrated into the new schema.
- 2026-10-16 — Phase 0 scaffold: Vite + React + TypeScript — fast, standard, Vercel's built-in preset; types catch content mistakes early.
- 2026-10-16 — Linter is oxlint (current Vite template default) instead of ESLint — same job, much faster, zero extra config; Prettier handles formatting.
- 2026-10-16 — No Tailwind for now; plain CSS variables as design tokens — region packs swap a small set of variables, keeping the look per region simple.
- 2026-10-16 — No installs on Tyler's own or borrowed devices — builds run in the cloud session and on Vercel; Tyler only uses the browser.
- 2026-10-17 — Live on Vercel at https://travel-earth-ivory.vercel.app (Hobby plan, auto-deploys from `main`) — free, already in use, GitHub-linked; `vercel.json` pins the Vite build so dashboard presets can't break it.
- 2026-10-17 — Cesium ion token "Japan Earth web app" allowlist now includes the Vercel URL and http://localhost:5173 — Phase 0 complete.
- 2026-10-17 — Bottom tabs for now: **Map · Journal** (Tyler's call) — keep it minimal before the trip; Plan can return later.
- 2026-10-17 — Map engine: **Cesium from the start**, strictly on the free Cesium ion Community plan (~1,000 Google 3D loads/month, stops instead of billing; no card ever) — photoreal look was the goal; Italia (MapLibre) is a reference for features only, ported piece by piece after Tyler ticks a checklist.

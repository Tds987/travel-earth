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

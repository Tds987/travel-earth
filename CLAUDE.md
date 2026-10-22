# CLAUDE.md — Travel Earth (working name)

Read this whole file before writing code. It is the brief for a from-scratch build.

## What we're building
A Google Earth–style travel guide for **an ordinary traveler**: open it, see a beautiful 3D map of where you are going, tap a place to learn why it matters and what it costs, plan the days, keep a private journal.

- **First content:** Tyler's Japan trip (Oct 22 – Nov 14, 2026), anchored by the Japan Series baseball championship (Oct 24 – Nov 1).
- **Built to scale:** later regions (Southeast Asia, Hawaii, US West Coast, Italy) are added as *data*, never as new code paths.
- **Why:** Tyler is building this to level up his own app-building skills. Treat it like a real product: clean architecture, readable code, small commits, explain decisions briefly in commit messages.
- **Only user today is Tyler**, but every screen must pass the **stranger test**: hand the phone to someone who has never seen it; within 10 seconds they know what it is and what to tap.

## Lessons from earlier attempts (do NOT repeat)
1. **Too dense** (Tyler's Italy app, italia-travel.vercel.app): ~18 always-visible controls — 7 stacked side buttons, 2 floating buttons, a country switcher, 7 category icons, clustered numbered pins. The map drowned.
2. **Category filters in the bottom bar were worse** than section tabs. Food / coffee / gelato / wine belong in a filter sheet, not the nav.
3. **Hard for anyone else to use**: icon-only controls, inside jargon, no obvious starting point.
4. **Looked archaic and pixelly** (japan-earth v2): Cesium rendered at CSS-pixel resolution on hi-DPI screens, emoji used as icons, generic dark-glass panels, map credits cluttering the view.
5. **Kept from v2 (good):** bottom tab bar of *sections* (Map / Series / Journal), fly-to animations, tilt into 3D, a card that explains *why a place matters*, prices in yen AND dollars, a "Bourdain was here" flag.

## UX principles
- **The map is the screen.** At rest show at most: a search field (top), section tabs (bottom), one small cluster for 3D/locate. Everything else appears on demand and goes away.
- **One obvious starting point.** Opening the app answers "what's next for me today?"
- **Words over icons.** Every control has a text label or an unmistakable icon + accessible name. Plain language ("Train times", not a pictogram).
- **Filters live in search.** Tapping search opens one sheet: text search + simple chips (Food, Sights, Nature, Open now, Near me, Bourdain).
- **Guide with options, never dictate.** Tyler's rule: offer choices with hours, typical time needed, cost and travel time. Never build hour-by-hour schedules for his days; he decides the order and pace.
- **Progressive disclosure.** Place card has a peek state (name, one line, price, distance) → full state (story, tips, hours, directions).
- **Thumb-first.** Primary actions in the bottom half, 44px+ targets, works one-handed.
- **Bottom tabs:** Tyler decides the final set. Working proposal: **Map · Plan · Journal** (Plan shows the trip anchor, e.g. the Japan Series schedule, then day-by-day).
- Accessible: WCAG AA contrast, visible focus, respects reduced motion, screen-reader names on the map controls.

## Design direction — "Japan" region pack
The core UI is neutral and calm; each region pack supplies palette, type accents, motifs and currency.
- **Ma (間):** generous negative space; few, quiet surfaces; the map does the talking.
- **Washi-paper cards** (warm off-white, subtle fiber texture) instead of dark glass; light theme default, considered dark theme.
- **Traditional colors** (see nipponcolors.com): sumi ink (text), kinari/unbleached (surfaces), shu vermilion (single accent), ai indigo (secondary), matcha (success/visited).
- **Goshuin-chō journal:** marking a place visited presses a red seal stamp into the journal, like the temple seal books pilgrims carry. The journal becomes a passport you fill.
- **JR / Tokyo Metro wayfinding:** itinerary and travel days use colored line badges and station-style codes (e.g. "JS01" for Japan Series Game 1). Clean, legible, very Japan.
- **72 micro-seasons** (shichijūni kō) name the seasonal layer (early Nov: "maple leaves and ivy turn yellow").
- **Type:** Zen Old Mincho or Shippori Mincho for display (with restraint), a clean sans (e.g. Zen Kaku Gothic New / Inter-alternative) for body, tabular numerals for prices.
- **Icons:** one consistent vector icon set (e.g. Lucide or Phosphor). No emoji in UI.
- Inspiration, not imitation: shin-hanga woodblock palettes (Kawase Hasui, Hiroshi Yoshida), Muji restraint, JR signage. Never reproduce copyrighted artwork or logos.
- Other region packs later (e.g. Italy: terracotta/ultramarine, maiolica motifs, euro).

## Tech stack (proposed — confirm with Tyler before installing)
- **Vite + React + TypeScript**, deployed on **Vercel** (Tyler already has an account).
- **CesiumJS** (via `resium` or a thin wrapper) with **Google Photorealistic 3D Tiles through Cesium ion's free Community plan** (no credit card; ~1,000 Google 3D loads/month, one per app open; stops instead of billing). Fallback to Cesium World Terrain + Bing imagery if the quota is hit.
  - **Must:** `viewer.useBrowserRecommendedResolution = false` and set `resolutionScale` to devicePixelRatio (capped ~2) so it's sharp on phones; offer a Data saver toggle.
  - Pins as crisp SVG/canvas billboards at device pixel ratio; label collision/decluttering; hide credits into a small "ⓘ Map data" control that still satisfies Google/Cesium attribution rules.
- **State/data:** content as typed JSON per region in the repo (`/content/japan/places.json` etc.). User data (marks, journal, photos) local-first (IndexedDB via Dexie), with optional **Supabase** (free tier) sync later so the journal follows Tyler across devices.
- **PWA:** installable, app shell cached, graceful offline/weak-signal states (Tyler travels on an eSIM).
- Styling: CSS variables as design tokens (region packs swap tokens). Tailwind is fine if Tyler wants it.
- **Secrets:** Cesium ion token restricted by URL in the Cesium dashboard (account "TJapan"); add the new Vercel domain + localhost to its allowed URLs. Never commit other secrets; use Vercel env vars.

## Data model (sketch)
```ts
type Region = { id: 'japan'; name: string; currency: 'JPY'; usdRate: number; pack: 'japan'; bounds: [w,s,e,n] };
type Place = {
  id: string; region: string; name: string; localName?: string;
  lat: number; lon: number; city: string;
  category: 'food'|'sight'|'nature'|'stay'|'event'|'baseball'|'fishing'|'season';
  why: string;            // 2–4 sentences, why it matters for THIS traveler
  tips?: string[]; price?: { min: number; max: number; estimate?: boolean } // local currency
  dates?: { start: string; end: string }; seasonPeak?: { start: string; end: string };
  flags?: { bourdain?: boolean }; sources?: string[]; updated: string;
};
type Mark = { placeId: string; state: 'want'|'visited'; at: string };
type JournalEntry = { id: string; date: string; placeId?: string; title: string; body: string; photoIds: string[] };
```

## Workflow rules
- **Screenshot loop:** after any UI change, run the app and capture Playwright screenshots at **390×844 (phone)** and **1440×900 (desktop)**, light and dark. Look at them before saying a change is done.
- Small, focused commits; one feature per branch/PR when practical.
- Ask Tyler before adding a dependency, a paid service, or changing the tab structure.
- Keep a short `DECISIONS.md` log in the repo (date — decision — why).

## Build phases
0. **Setup:** scaffold, lint/format, deploy a hello-world to Vercel, Cesium token allowlist updated.
1. **Sharp map shell:** globe intro (St. Louis → Japan), photoreal 3D, crisp pins, minimal chrome, tabs.
2. **Place card + search/filter sheet:** peek/full card, yen + USD, Bourdain flag, directions link.
3. **Journal (goshuin):** private entries, photos, visited = seal stamp.
4. **Plan tab:** Japan Series 2-3-2 schedule with JR-style badges, then day-by-day.
5. **PWA + weak-signal polish.**
6. **Prove scale:** add a second region pack (import Italy data) with zero engine changes.

## Repository
- GitHub: https://github.com/Tds987/travel-earth. Deploy target: Vercel.
- Reference data: `legacy/places.js` must sit in the repo (upload it if missing).

## Existing assets to reuse
- `legacy/places.js` — ~50 researched Japan places (food, history, hikes, fishing, temple stays, festivals in window, autumn color, Japan Series venues) with "why it matters" copy, tips, yen prices (estimates flagged). Migrate into the new schema.
- Old builds for reference only: github.com/Tds987/japan-earth (CesiumJS v2), italia-travel.vercel.app (Italy app).
- Full trip context and decision history: the "Travel Japan" Claude Project doc `claude/travel-map-decision-log.md`.

## Trip facts the app should reflect
- Japan Series 2-3-2: Games 1–2 Oct 24–25 at the Central League champion's park; Games 3–5 Oct 27–29 at the Pacific League champion's park; Games 6–7 Oct 31 / Nov 1 back at the CL park. Teams set after the Climax Series (finals Oct 14–19). Ticket ceiling $200.
- Interests: food (will try anything), ancient history, views, baseball, fishing, hiking, concerts, festivals in the window, autumn color. Budget-conscious solo traveler, hostels plus a few splurges (temple stay at Koyasan).
- Guide voice for copy: curious, food-first, honest, practical, warm — think Bourdain meets Rick Steves.

# Independent Homestyler clone prototype

**Status:** ongoing, independently authored prototype on `hiruuu30/homestyler_clone` main. The latest incremental milestone adds independent per-room ceiling swatches to the wall and furniture color workflow, with translucent 3D rendering and SVG metadata. The public production alias is [homestyler-clone.vercel.app](https://homestyler-clone.vercel.app/); the feature ledger records verified code revisions and bundle evidence. This is not a complete clone or a parity claim. Original catalog assets remain deferred.

## Current milestone: room ceiling finishes

Select a room, choose Ceiling in Finishes, and pick a generic color swatch. The room stores its ceiling material ID separately from its floor finish. The translucent 3D ceiling resolves that color, Undo/Redo and local save/reload preserve the assignment, and SVG export records the ceiling material metadata while leaving the floor fill unchanged. Earlier whole-wall and furniture swatch assignment remains available.

This is a simple color assignment on a generic translucent ceiling, not a textured/PBR ceiling system. It does not reproduce Homestyler materials or catalog assets; corresponding reference behavior has not been verified. Earlier per-room procedural floor mapping remains available, with its own limitations below.

## Other implemented capabilities

The independent editor also supports rectangular and concave polygon rooms, snapping, wall topology repair and collinear joins, hosted door/window openings, editable wall properties, multiple floors, floor-surface openings, translucent 3D ceilings, procedural per-room floor-finish mapping, furniture transforms and arrays, hidden-object recovery, local persistence, plan underlays, unit conversion, and SVG/CSV/JSON exports. These generic implementations do not establish equivalent Homestyler behavior.

## Verification and boundaries

- **Verified full-parity completion: 0%.** No complete feature/state suite has passed exact functional and pixel-level comparison.
- **Original catalog asset coverage: 0%.** No original Homestyler models, materials or textures are present.
- **Local checks:** 103 unit tests pass; the strict TypeScript/Vite production build succeeds, with a warning for the large lazy 3D chunk. Chromium verified ceiling, wall and furniture swatches, Undo/Redo, save/reload, and 40,169/19,926/6,317 changed 3D viewport pixels after undoing ceiling/wall/object colors respectively, with no page errors.
- **Production:** the public alias returns HTTP 200, and its HTML plus every JavaScript/CSS asset—including the lazy 3D chunk—match the tested production build byte-for-byte; details are in `docs/feature-ledger.csv`.
- Significant scope remains incomplete, including broader topology, catalog/material coverage, cloud workflows, advanced/server-dependent features, and a comprehensive golden-image suite. Use only independently authored code and generic procedural finishes until authorized licensed assets are available.

## Project files

- [Technical specification and observations](docs/TECHNICAL_SPECIFICATION.md)
- [Local implementation and release plan](docs/CODEX_CLOUD_IMPLEMENTATION_PLAN.md)
- [Feature and verification ledger](docs/feature-ledger.csv)
- [PingFusi capability results and bounded visual milestone](docs/PINGFUSI_CAPABILITY_RESULTS.md)
- [REA capabilities: worked, blocked and untested (historical)](docs/REA_CAPABILITY_RESULTS.md)
- [Sanitized static-analysis evidence](docs/evidence/rea-static-summary.json)
- [Sanitized authenticated-CDP evidence](docs/evidence/rea-authenticated-cdp-summary.json)
- [Historical graphics audit](docs/WEBGL_ENVIRONMENT_AUDIT.md)

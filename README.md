# Independent Homestyler clone prototype

**Status:** ongoing, independently authored prototype on `hiruuu30/homestyler_clone` main. The latest deployed milestone adds per-room floor-finish mapping controls and procedural plan/3D rendering. The public production alias is [homestyler-clone.vercel.app](https://homestyler-clone.vercel.app/); the feature ledger records the verified code revision and bundle evidence. This is not a complete clone or a parity claim. Original catalog assets remain deferred.

## Current milestone: floor-finish mapping

Rooms can use a generic wood-plank or square-tile pattern, optionally tinted by the selected floor material. Rotation, horizontal/vertical offset, and independent X/Y scale are editable in the room inspector. The mapping appears in the 2D plan and 3D floor, is included in editable SVG exports, survives local save/reload and Undo/Redo, and converts its linear offsets when switching between metres and feet. Older projects default to an unpatterned floor.

These are original procedural patterns, not Homestyler textures or catalog materials. Reference controls were observed, but their exact mapping, UV, scale and material behavior has not been tested against Homestyler.

## Other implemented capabilities

The independent editor supports rectangular and concave polygon rooms, snapping, wall topology repair and collinear joins, hosted door/window openings, editable wall properties, multiple floors, floor-surface openings, translucent 3D ceilings, furniture transforms and arrays, hidden-object recovery, local persistence, plan underlays, unit conversion, and SVG/CSV/JSON exports. These generic implementations do not establish equivalent Homestyler behavior.

## Verification and boundaries

- **Verified full-parity completion: 0%.** No complete feature/state suite has passed exact functional and pixel-level comparison.
- **Original catalog asset coverage: 0%.** No original Homestyler models, materials or textures are present.
- **Local checks:** 96 unit tests pass; the strict TypeScript/Vite production build succeeds, with a warning for the large lazy 3D chunk. Chromium verified visible 2D/3D pattern changes, transformed mapping values, Undo/Redo, save/reload, and no page errors.
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

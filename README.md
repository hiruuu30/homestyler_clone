# Independent room-planner prototype and Homestyler research

**Status:** ongoing, independently authored prototype on `hiruuu30/homestyler_clone` main. The latest milestone makes the existing per-room “Show ceiling in 3D” control render a translucent ceiling at the active floor's configured height. Production status is tracked separately in the feature ledger at [homestyler-clone.vercel.app](https://homestyler-clone.vercel.app/). This is not a complete clone or a parity claim; original Homestyler catalog assets remain deferred.

## Current milestone

The 3D scene now creates a triangulated ceiling for each visible room on the active floor, at the active level's elevation plus its configured height. Hiding a room ceiling removes its mesh. Older project data without a ceiling visibility value defaults to visible, while explicit off values persist. Ceilings are translucent in this independent implementation to keep the current exterior-style 3D camera useful. Room floor-surface openings are not silently passed through the ceiling; they remain distinct from structural through-slab openings.

The geometry helper and active-floor filtering are tested locally. Headless Chromium confirmed that toggling the control changes the 3D canvas, Undo/Redo works, and the visibility value survives save/reload. No Homestyler ceiling rendering or behavior comparison has been completed; exact materials, camera/roam semantics, slab thickness, multi-floor occlusion, and through-slab behavior remain unknown.

## Existing prototype capabilities

The independent local editor supports rectangular and concave polygon rooms, snapping, wall topology repair and collinear joins, hosted door/window openings, editable wall properties, multiple floors, furniture transforms and arrays, hidden-object recovery, local save/reload, plan underlays, unit conversion, and SVG/CSV/JSON exports. The latest prior increment adds room floor-surface openings with net-area deduction and 2D/3D geometry. These generic implementations do not establish equivalent Homestyler behavior.

## Verification and boundaries

- **Verified full-parity completion: 0%.** No complete feature/state suite has passed exact functional and pixel-level comparison.
- **Original catalog asset coverage: 0%.** The source catalog is deferred; the application contains no original Homestyler models, materials, or textures.
- **Local checks:** 89 unit tests pass; the strict TypeScript/Vite production build succeeds (with the existing large 3D chunk warning); the ceiling browser smoke test verified canvas pixel changes, Undo/Redo, local persistence, and zero page errors.
- **Production:** the currently verified public bundle and its evidence are recorded in `docs/feature-ledger.csv`; deployment validation is separate from local tests.
- Full scope remains incomplete, including advanced/server-dependent features, broader topology, catalog/material coverage, cloud workflows, and a comprehensive golden-image suite. Use only independently authored code and generic placeholder assets until authorized licensed assets are available.

## Project files

- [Technical specification and observations](docs/TECHNICAL_SPECIFICATION.md)
- [Local implementation and release plan](docs/CODEX_CLOUD_IMPLEMENTATION_PLAN.md)
- [Feature and verification ledger](docs/feature-ledger.csv)
- [PingFusi capability results and bounded visual milestone](docs/PINGFUSI_CAPABILITY_RESULTS.md)
- [REA capabilities: worked, blocked and untested (historical)](docs/REA_CAPABILITY_RESULTS.md)
- [Sanitized static-analysis evidence](docs/evidence/rea-static-summary.json)
- [Sanitized authenticated-CDP evidence](docs/evidence/rea-authenticated-cdp-summary.json)
- [Historical graphics audit](docs/WEBGL_ENVIRONMENT_AUDIT.md)

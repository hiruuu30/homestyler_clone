# Independent room-planner prototype and Homestyler research

**Status:** the incomplete generic prototype was explicitly authorized for release. The visual/camera source milestone `c2c0364d1390eb29bbf1a4b5e706c814bd3bac29` is pushed to `hiruuu30/homestyler_clone` main and its Vercel production deployment under team `hiroo1` is READY at [homestyler-clone.vercel.app](https://homestyler-clone.vercel.app/). Public HTTP, bounded PingFusi overview measurements, and 3D-load checks passed. This is not a complete-clone or parity claim. Original Homestyler catalog assets remain deferred.

## Current milestone

The latest increment aligns the generic right-pane overview to the reference’s measured `220 × 160` rectangle at `(1042, 60)` in a `1280 × 649` viewport. Both room-label bounding boxes are within `0.7px` of the measured reference, locally and in production. The starter uses approximate independent two-room geometry—not the reference project’s room dimensions or areas—and label-specific SVG tuning; this is not a matched full-project or pixel-image result. The 3D camera now frames project bounds and adapts to viewport aspect.

Verified locally in isolated Chromium: generic furniture can be dragged in both the 2D plan and 3D scene; a 3D floor-plane drag updates the shared project and is undoable/redoable. The inspector edits position, size, rotation, wall thickness and wall height. Projects support named floors with distinct elevations, per-floor geometry, floor switching, undoable deletion, and local save/reopen. Local browser checks confirmed floor switching/filtering, wall-height editing, and persistence after reload. The strict TypeScript/Vite build passes and all 25 unit tests pass; the build still reports the existing large 3D bundle warning.

This is a generic starter editor, not a demonstrated Homestyler clone. A bounded PingFusi comparison measured selected room-label geometry, but no feature has passed Homestyler parity acceptance; exact camera, collision, snapping, advanced modeling, cloud and catalog behaviors remain unverified. See [PingFusi capability results](docs/PINGFUSI_CAPABILITY_RESULTS.md).

## Progress and boundaries

- **Verified full-parity completion: 0%.** This is the share of required features/states accepted against exact functional and pixel-level parity, not a measure of research or code volume.
- **Original catalog asset coverage: 0%.** The source catalog is deferred and the application does not contain original Homestyler models, materials or textures.
- Strict full functional and pixel-level parity remains the goal and its acceptance gates still apply to any complete-clone claim. The user nevertheless explicitly authorized this incomplete generic prototype release despite unmet gates.
- Use only independently authored code and generic placeholder assets until an authorized catalog corpus is delivered. Do not use private service endpoints or claim the placeholders are equivalent.

## Discovery background

The authenticated editor research, technical specification, REA capability limits, PingFusi capability results and feature ledger remain useful as evidence and implementation references. REA static analysis worked on one public script. The original managed browser remains not externally attachable: its private control channel is not a supported loopback CDP endpoint. Separately, a fresh manually authenticated Chrome profile launched with explicit loopback CDP port `9224` was passively inspected with exact origin allowlists; this produced safe generic DOM/accessibility counts but does not establish complete Homestyler internals or exhaustive feature coverage.

## Project files

- [Technical specification and observations](docs/TECHNICAL_SPECIFICATION.md)
- [Local implementation and release plan](docs/CODEX_CLOUD_IMPLEMENTATION_PLAN.md)
- [REA capabilities: worked, blocked and untested (historical)](docs/REA_CAPABILITY_RESULTS.md)
- [PingFusi capability results and bounded visual milestone](docs/PINGFUSI_CAPABILITY_RESULTS.md)
- [Feature and verification ledger](docs/feature-ledger.csv)
- [Sanitized static-analysis evidence](docs/evidence/rea-static-summary.json)
- [Sanitized authenticated-CDP evidence](docs/evidence/rea-authenticated-cdp-summary.json)
- [Historical graphics audit](docs/WEBGL_ENVIRONMENT_AUDIT.md)

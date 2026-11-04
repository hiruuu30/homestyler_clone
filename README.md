# Independent room-planner prototype and Homestyler research

**Status:** local feature implementation is in progress by the user's latest direction. Original Homestyler catalog assets are deferred. Nothing has been pushed or deployed.

## Current milestone

Verified locally in isolated Chromium: generic furniture can be dragged in both the 2D plan and 3D scene; a 3D floor-plane drag updates the shared project and is undoable/redoable. The inspector edits position, size, rotation, wall thickness and wall height. Projects support named floors with distinct elevations, per-floor geometry, floor switching, undoable deletion, and local save/reopen. Local browser checks confirmed floor switching/filtering, wall-height editing, and persistence after reload. The strict TypeScript/Vite build passes and all 22 unit tests pass; the build still reports a large 3D bundle warning.

This is a generic starter editor, not a demonstrated Homestyler clone. No pixel comparison has been done, no feature has passed Homestyler parity acceptance, and exact camera, collision, snapping, advanced modeling, cloud and catalog behaviors remain unverified.

## Progress and boundaries

- **Verified full-parity completion: 0%.** This is the share of required features/states accepted against exact functional and pixel-level parity, not a measure of research or code volume.
- **Original catalog asset coverage: 0%.** The source catalog is deferred and the application does not contain original Homestyler models, materials or textures.
- Strict full functional and pixel-level parity remains the goal. The user's direction permits continued local implementation of non-catalog features; it does not waive the acceptance requirement or authorize pushing or deployment.
- Use only independently authored code and generic placeholder assets until an authorized catalog corpus is delivered. Do not use private service endpoints or claim the placeholders are equivalent.

## Discovery background

The authenticated editor research, technical specification, REA capability limits and feature ledger remain useful as evidence and implementation references. REA static analysis worked on one public script. REA could not attach to the authenticated Homestyler browser because no supported endpoint was supplied; it did successfully inspect this prototype in a separate disposable Chromium instance launched with an explicit loopback CDP endpoint. Neither result establishes complete Homestyler internals or exhaustive feature coverage.

## Project files

- [Technical specification and observations](docs/TECHNICAL_SPECIFICATION.md)
- [Local implementation and release plan](docs/CODEX_CLOUD_IMPLEMENTATION_PLAN.md)
- [REA capabilities: worked, blocked and untested](docs/REA_CAPABILITY_RESULTS.md)
- [Feature and verification ledger](docs/feature-ledger.csv)
- [Sanitized static-analysis evidence](docs/evidence/rea-static-summary.json)
- [Historical graphics audit](docs/WEBGL_ENVIRONMENT_AUDIT.md)

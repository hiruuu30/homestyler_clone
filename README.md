# Independent room-planner prototype and Homestyler research

**Status:** code commit `7c7c2a8` is pushed to `hiruuu30/homestyler_clone` main. Production at [homestyler-clone.vercel.app](https://homestyler-clone.vercel.app/) returns HTTP 200 and serves bundle `index-B0iNuTIL.js`, matching the fresh local build and containing array, hide/show, Fit view and wall-endpoint controls. This remains the incomplete generic prototype explicitly authorized for release, not a complete-clone or parity claim. Original Homestyler catalog assets remain deferred.

## Current milestone

A bounded PingFusi comparison aligned selected room-label geometry in a generic two-room overview, but the starter uses approximate independent geometry—not the reference project's room dimensions or areas. This remains component-level evidence, not a matched full-project or pixel-image result.

Recent local increments add linear furniture arrays with copy count and X/Y spacing; persistent hide/show with recovery from the project panel; 2D wheel zoom, Shift/middle/right-drag pan and Fit view reset; and numeric wall start/end coordinates with a live size readout. Fit view also re-frames the 3D viewport. Prior local work includes undoable wall splitting, endpoint snapping, furniture transforms and elevation, multi-floor authoring, and local save/reopen.

Verified locally: all 37 unit tests pass and the strict TypeScript/Vite build succeeds. In isolated Chromium, array creation survived Undo/Redo and save/reload; hiding survived Undo/Redo and reload and was restored from the project list; plan zoom/pan/Fit changed and restored the viewBox; the 3D canvas remained live after Fit; and changing a wall endpoint changed its displayed length, with Undo restoring both coordinate and size. The public production bundle was checked for the current controls. These checks validate only the independent local implementation, not Homestyler behavior. The build still reports the existing large 3D bundle warning.

This is a generic starter editor, not a demonstrated Homestyler clone. No feature has passed Homestyler parity acceptance. Exact camera behavior, collision, topology, advanced modeling, cloud workflows and catalog coverage remain unverified. See [PingFusi capability results](docs/PINGFUSI_CAPABILITY_RESULTS.md).

## Progress and boundaries

- **Verified full-parity completion: 0%.** This is the share of required features/states accepted against exact functional and pixel-level parity, not a measure of research or code volume.
- **Original catalog asset coverage: 0%.** The source catalog is deferred and the application does not contain original Homestyler models, materials or textures.
- Strict full functional and pixel-level parity remains the goal and its acceptance gates still apply to any complete-clone claim. The user nevertheless explicitly authorized this incomplete generic prototype release despite unmet gates.
- Use only independently authored code and generic placeholder assets until an authorized catalog corpus is delivered. Do not use private service endpoints or claim the placeholders are equivalent.

## Discovery background

The authenticated editor research, technical specification, REA capability limits, PingFusi capability results and feature ledger remain useful as evidence and implementation references. REA static analysis worked on one public script. The original managed browser remains not externally attachable: its private control channel is not a supported loopback CDP endpoint. Separately, a fresh manually authenticated Chrome profile was passively inspected with exact origin allowlists; this produced safe generic DOM/accessibility counts but does not establish complete Homestyler internals or exhaustive feature coverage.

## Project files

- [Technical specification and observations](docs/TECHNICAL_SPECIFICATION.md)
- [Local implementation and release plan](docs/CODEX_CLOUD_IMPLEMENTATION_PLAN.md)
- [REA capabilities: worked, blocked and untested (historical)](docs/REA_CAPABILITY_RESULTS.md)
- [PingFusi capability results and bounded visual milestone](docs/PINGFUSI_CAPABILITY_RESULTS.md)
- [Feature and verification ledger](docs/feature-ledger.csv)
- [Sanitized static-analysis evidence](docs/evidence/rea-static-summary.json)
- [Sanitized authenticated-CDP evidence](docs/evidence/rea-authenticated-cdp-summary.json)
- [Historical graphics audit](docs/WEBGL_ENVIRONMENT_AUDIT.md)

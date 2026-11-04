# Independent room-planner prototype and Homestyler research

**Status:** code commit `e652684` is pushed to `hiruuu30/homestyler_clone` main. Vercel deployment `dpl_9PrKEcxi6ec1rrH1pzCoBwZsd2RR` is READY for production. [homestyler-clone.vercel.app](https://homestyler-clone.vercel.app/) returns HTTP 200 and serves `index-DPgQG0Qj.js`, byte-identical to the local build (SHA-256 `f38714593c84430408d0585117e7eda4efa5b18ce0f893403ee19c136ae768cc`). The bundle contains the SVG/CSV export controls and the generic wall-hosted door/window controls. This remains the incomplete prototype explicitly authorized for release, not a complete-clone or parity claim. Original Homestyler catalog assets remain deferred.

## Current milestone

A bounded PingFusi comparison aligned selected room-label geometry in a generic two-room overview, but the starter uses approximate independent geometry—not the reference project's room dimensions or areas. This remains component-level evidence, not a matched full-project or pixel-image result.

The newest local increment adds independent plan deliverables: the Project panel exports an editable SVG for the active floor and a project-wide CSV quantity schedule, alongside the existing RoomLab JSON export. SVG includes room shapes/areas, wall lines, hosted door/window symbols, and visible generic furniture. CSV includes floors, rooms, walls, openings, and all furniture (including hidden objects), with metric fields and separate material/asset identifiers; foot-unit source projects are converted to metric. These are independently generated formats, not claimed to match Homestyler's exports.

The previous increment adds generic wall-hosted single doors and windows. Openings are placed on a selected wall, edited numerically, drawn in the plan, and cut into 3D wall meshes; generic door leaves and window glass are placeholders, not catalog assets. Bounds and overlaps are validated, and openings follow wall deletion/splitting, floor removal, Undo and local project save/reopen. Earlier increments add linear furniture arrays with copy count and X/Y spacing; persistent hide/show with recovery from the project panel; 2D wheel zoom, Shift/middle/right-drag pan and Fit view reset; and numeric wall start/end coordinates with a live size readout. Fit view also re-frames the 3D viewport.

Verified locally: all 47 unit tests pass and the strict TypeScript/Vite build succeeds. Headless Chromium downloaded both deliverables from the Project panel; the SVG parsed as XML and contained the expected room/wall geometry, and the 19-column CSV parsed with level, room, and wall schedule rows. Isolated Chromium previously verified door/window placement, editing and save/reload. All checks validate only the independent local implementation, not Homestyler behavior. The build still reports the existing large 3D bundle warning.

This is a generic starter editor, not a demonstrated Homestyler clone. No feature has passed Homestyler parity acceptance. Hosted-opening controls were observed on the reference, but its precise sizing, hosting, cut, swing, glass, topology and save semantics have not been verified against this implementation. Exact camera behavior, collision, topology, advanced modeling, cloud workflows and catalog coverage remain unverified. See [PingFusi capability results](docs/PINGFUSI_CAPABILITY_RESULTS.md).

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

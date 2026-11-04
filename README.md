# Independent room-planner prototype and Homestyler research

**Status:** the latest verified production release is commit `b4aea0e` on `hiruuu30/homestyler_clone` main, Vercel deployment `dpl_FGqQgwEF2XfRAxvXVZs1yA4SaTxD` (READY). [homestyler-clone.vercel.app](https://homestyler-clone.vercel.app/) returns HTTP 200 and serves the metric/imperial project-units build. Local work now includes custom polygon rooms, floor-plan image underlays and connected wall-node edits; these increments are not in production because GitHub publishing failed without an authenticated repository session. This remains an incomplete, independently authored prototype—not a complete-clone or parity claim. Original Homestyler catalog assets remain deferred.

## Current milestone

The local editor adds click-to-draw custom polygon rooms, including concave outlines. Vertices snap to existing plan points; the outline closes by clicking its first vertex or pressing Enter, and Escape cancels. Self-crossing outlines, zero-length edges, and rooms below the minimum area are rejected. A valid room creates a floor surface and one wall segment per edge. This is independent geometry; exact same-floor endpoint edits now update connected walls and room vertices, but robust shared-wall joins, wall-interior intersections, openings across joins, holes, and automatic topology repair remain unimplemented.

The disabled floor-plan import card is now an independent local image-underlay workflow: PNG/JPEG/WebP files are downsampled and stored in the local project, assigned to the active floor, and can be resized, repositioned, faded, removed and restored with Undo. Width and position use project units, and underlay geometry follows unit conversion. A 1.5-million-character encoded-image limit and opaque JPEG conversion are deliberate local-storage safeguards; this is not Homestyler's verified import behavior.

Wall endpoint edits now treat exact shared coordinates as implicit nodes within the same floor: connected wall ends and matching room-outline vertices move in one undoable project update. Edits are rejected if they collapse a wall/room edge, self-intersect a room, or invalidate a hosted opening; identical coordinates on other floors remain independent. This is a bounded consistency improvement, not a complete planar graph, snap-tolerance network, or recovered reference behavior.

A bounded PingFusi comparison aligned selected room-label geometry in a generic two-room overview, but the starter uses approximate independent geometry—not the reference project's room dimensions or areas. This remains component-level evidence, not a matched full-project or pixel-image result.

An earlier local increment added an undoable metric/imperial project-units selector. Switching units converts all stored linear geometry and dimensions (floors, rooms, walls, openings and furniture) while preserving physical size; area labels switch between m² and ft², numeric fields show the chosen unit, and the views refit. New starter geometry, floors, walls and openings also use unit-aware defaults. This is a proposed independent unit model, not a claim about Homestyler's mixed-unit behavior.

An earlier local increment added independent plan deliverables: the Project panel exports an editable SVG for the active floor and a project-wide CSV quantity schedule, alongside the existing RoomLab JSON export. SVG includes room shapes/areas, wall lines, hosted door/window symbols, and visible generic furniture. CSV includes floors, rooms, walls, openings, and all furniture (including hidden objects), with metric fields and separate material/asset identifiers; foot-unit source projects are converted to metric. These are independently generated formats, not claimed to match Homestyler's exports.

The previous increment adds generic wall-hosted single doors and windows. Openings are placed on a selected wall, edited numerically, drawn in the plan, and cut into 3D wall meshes; generic door leaves and window glass are placeholders, not catalog assets. Bounds and overlaps are validated, and openings follow wall deletion/splitting, floor removal, Undo and local project save/reopen. Earlier increments add linear furniture arrays with copy count and X/Y spacing; persistent hide/show with recovery from the project panel; 2D wheel zoom, Shift/middle/right-drag pan and Fit view reset; and numeric wall start/end coordinates with a live size readout. Fit view also re-frames the 3D viewport.

Verified locally: all 55 unit tests pass and the strict TypeScript/Vite build succeeds. Headless Chromium verified custom-room drawing and an image underlay end to end, then confirmed wall endpoint edits propagate to neighboring walls and room outlines, survive Undo/Redo and local save/reload, load a nonzero-size 3D viewport, and reject invalid geometry with a toast and no page errors. Earlier browser checks verified image calibration/opacity/unit conversion, room validation, unit labels, a 2.95 ft default door width, and SVG/CSV downloads and parsing. These checks validate only this independent local implementation, not Homestyler behavior. The build still reports the existing large 3D bundle warning.

This is a generic starter editor, not a demonstrated Homestyler clone. No feature has passed Homestyler parity acceptance. Hosted-opening controls were observed on the reference, but its precise sizing, hosting, cut, swing, glass, topology and save semantics have not been verified against this implementation. Custom-room, underlay and endpoint-propagation behavior have only local tests; robust wall joins, wall-interior intersections, holes, CAD imports, collision, advanced modeling, cloud workflows and catalog coverage remain unverified. See [PingFusi capability results](docs/PINGFUSI_CAPABILITY_RESULTS.md).

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

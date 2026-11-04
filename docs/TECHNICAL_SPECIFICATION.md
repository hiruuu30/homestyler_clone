# Independent room planner: technical specification

## What is established

The authenticated Homestyler editor loads in the supplied Cloud Browser. The earlier WebGL startup failure is historical, not the current blocker. A free template was opened in both 2D and 3D; rectangular-room creation, wall editing, furniture placement and rotation, floor-material assignment, camera orbit, and private saving/reopening were successfully exercised. Undo was confirmed for the wall edit, new rectangle and material change. The two follow-up edits were restored rather than explicitly saved.

The repository now contains a local generic starter editor under the user's instruction to continue non-catalog implementation and defer original assets. It is not a completed clone. Strict full functional and pixel-level parity remains the acceptance target, and no local feature has passed Homestyler parity acceptance. Unit tests and a local Chromium smoke test validate only this starter's own operations. The user explicitly authorized this incomplete prototype release: commit `c2c0364d1390eb29bbf1a4b5e706c814bd3bac29` is pushed to `hiruuu30/homestyler_clone` main, and production deployment to Vercel project `homestyler-clone` under team `hiroo1` is READY for that commit at `https://homestyler-clone.vercel.app/`; public HTTP and basic 2D/3D load smoke checks passed without establishing parity.

REA 6.8.0 runs here and successfully parsed one public help-page JavaScript snippet as inert text. The original managed browser remains not externally attachable: its private control channel is not a supported loopback CDP endpoint. Separately, REA did discover and passively inspect a fresh manually authenticated Chrome profile explicitly launched with loopback CDP port `9224`, using exact origin allowlists for `www.homestyler.com` and `3d.homestyler.com`. CLI installation, static analysis, authenticated browser observation, and application implementation are separate accomplishments.

## Local implementation milestone — 2026-11-04

The independent starter now models named levels with elevations and per-level rooms, walls, and furniture. The editor can add, switch, and undoably delete floors; the 2D and 3D views scope geometry to the active level, and the 3D floor is placed at that level's elevation. Legacy local project files without level metadata migrate onto a ground floor. Wall height is numerically editable. These are proposed independent features, not recovered Homestyler internals.

Verification: 25 unit tests pass; `npm run build` succeeds with the existing large-3D-chunk warning. Isolated Chromium checks verified floor add/switch/delete/undo, active-level filtering, wall-height editing with trusted keyboard input, and save/reload persistence of both the two-floor project and a 3.1 m wall height. The synthetic input test was discarded because it changed only the visible draft; the trusted-input test confirms the committed value. A bounded PingFusi comparison now measures selected room-label geometry; no feature has passed Homestyler parity acceptance, and verified full-parity completion remains **0%**. See [PingFusi capability results](PINGFUSI_CAPABILITY_RESULTS.md).

## Current environment and tool evidence

| Evidence | Actual finding | Boundary |
| --- | --- | --- |
| Runtime | Node `v24.22.1`; npm `11.19.1`; Ubuntu sandbox | No separate Work cloud computer was available |
| REA installation | Global CLI `/usr/local/bin/rea`, version `6.8.0`; version/help work; installation required sudo for the global npm path | Already installed; not unnecessarily reinstalled |
| Official runtime requirement | Node 22.x >=22.23.4, 24.x >=24.22.1, or >=26.12.1 in the documented supported lines | Current runtime qualifies; see [REA installation guide](https://github.com/morluto/rea/blob/main/docs/installation.md) |
| REA doctor | Node/host healthy; overall readiness false; Hopper, Ghidra, IDA, JADX and Kuna not configured; bundled agent skill registration missing | Optional analysis engines were not installed or exercised |
| Chrome control | Only `--remote-debugging-pipe` observed in Chrome-family process flags | A private browser-control pipe is not an attachable loopback CDP URL |
| REA CDP discovery | `rea list-browser-targets http://127.0.0.1:9222 --format json` failed: `provider_unavailable` / `endpoint_unreachable` | This tested endpoint failed; no supported attachable endpoint was supplied. No claim that every possible port was tested |
| Static JavaScript test | Exit 0; one 619-byte inline script from the public help page parsed; 201 AST nodes, two findings, zero parse failures | Public help page only, not authenticated editor code; graph coverage partial and semantic coverage unknown |
| Browser fallback | Cloud Browser UI/AX observations and visual captures worked | These observations are not REA captures and reveal no private backend implementation |
| GitHub | Authorized repository `hiruuu30/homestyler_clone` resolved and cloned | No application source existed in the checkout |
| Vercel | Connected user email `hero.tolentino@gmail.com`; team `hiroo1` / Hero; project `homestyler-clone` (`prj_j7llNqVFhqAtOdhqnujWJJ7uzlJG`) | Production deployment READY for commit `c2c0364d1390eb29bbf1a4b5e706c814bd3bac29`; canonical alias `https://homestyler-clone.vercel.app/`; browser smoke not claimed |

The [REA browser guide](https://github.com/morluto/rea/blob/main/docs/browser-observation.md) requires an explicitly supplied, authorized Chrome-family CDP endpoint. Its observation surface is passive, not general browser control. No debugging port was exposed, cookies exported, private browser channel repurposed, or subscription restriction bypassed.

The current Cloud Browser's installed `browser_cdp` contract was also inspected. It exposes a small host-routed allowlist for tab/frame DOM, layout, accessibility and selected input commands; it explicitly does not expose arbitrary attach, browser-global commands or a debugging endpoint. No commands through that surface were invoked in this follow-up, and it remains not attachable by REA. A managed CDP command API is not a CDP URL usable by an external CLI. The separate authenticated-CDP result is summarized in [sanitized evidence](evidence/rea-authenticated-cdp-summary.json); raw captures remain private outside the repository.

The historical graphics/static-analysis failures remain in [the prior audit](WEBGL_ENVIRONMENT_AUDIT.md), clearly marked as superseded where current tests differ. REA results remain historical in [REA capability results](REA_CAPABILITY_RESULTS.md); the newer bounded capture and comparison are summarized separately in [PingFusi capability results](PINGFUSI_CAPABILITY_RESULTS.md).

## Authenticated workflows actually exercised

All tests used a new disposable design and a template visibly marked **Free**, not an existing personal project. Observations were made in the English interface at a 1280 × 649 CSS-pixel viewport. Exact DPR, fonts, renderer identity and a complete application build identifier were not frozen; the earlier loading UI identified the V6 family.

| Workflow | Action and observed result | Verification boundary |
| --- | --- | --- |
| Entry/setup | Manual sign-in; dismissed onboarding; selected metre units and the left-drag-orbit/right-drag-pan convention | The loaded template subsequently displayed mixed units; do not infer one global unit behavior |
| Plan/template | Build → Select Templates → Room Templates → **The Bright Minimal Room**, marked Free; geometry loaded with lobby and Living Room | Confirms this template, not arbitrary import or geometry behavior |
| Plan dimensions | Total building area displayed `504.91 ft²`; lobby `78.40 ft²`; Living Room `339.95 ft²`; walls/openings and dimension annotations visible | These are displayed reference values, not a recovered geometry schema |
| Rectangular room | Follow-up on the disposable saved design: Build → Draw Rooms → Draw Rooms (R); drawing parameters showed By inner edge, thickness `0.24 m`, Non-weight bearing. A detached rectangle became completed walls with `Unnamed / 1.45 m²`; inner dimensions displayed `0.815` and `1.777 m`. Total Building Area changed `46.91` → `49.83 m²`; Undo removed it and restored `46.91 m²` | Earlier unsuccessful attempts are superseded for basic rectangular-room creation only. L/T rooms, numeric entry, joins, snapping, adjacent-room behavior, save/reopen and clean gesture replay are not verified |
| Wall editing | Selected a straight wall; thickness `9.45 in` → `8`; committed with Enter; displayed thickness became `8.00`, Living Room area `340.64 ft²` | Confirms a real geometric/property update, not only a typed field |
| Undo | Toolbar Undo restored thickness `9.45` and Living Room area `339.95 ft²` | Redo and complete history semantics not tested |
| Furniture | Decorate → Furniture → Sofas; dragged an unmarked tile onto the room; selected item identified as `multi-seat sofa-Keith Haring Style` | No paid/check-in-locked tile was unlocked; no catalog models were copied |
| Object properties | Sofa width `6' 1''`, length `3' 4''`, height `2' 10''`, elevation `0' 0''`; selection box and handles visible | Numeric resizing, constraints and snapping were not tested |
| Rotation | Space changed the selected sofa's blue-axis rotation `0` → `45°`; footprint/distance annotations changed | Other rotation axes were visible but not exercised |
| Finishes | Decorate → Finish → Floor; wood swatches loaded. Tiles, Marble, Mosaic, Wallpaper, Tile combination, Color, carpets and other categories visible | Category/catalog observation is distinct from surface assignment |
| Floor-material assignment | Follow-up: used the first unmarked wood swatch, shown as `1463*1463 (mm)`. Living Room changed from a light finish to visible long wood planks in 2D and 3D, while lobby remained light. The 3D Basic Style panel identified `Wooden Floor_81`. Undo returned the material name `Small-format Limestone Tile II` and the original light texture | The intended drag target was lobby, but the actual changed surface was Living Room; precise pointer/drop targeting is not established. No wall/ceiling/object materials, brush/sample behavior, UV edits or material save/reopen were tested |
| Material properties | Basic Style exposed No pattern, Material, Color overlay off, Rotation Angle `0°`, horizontal/vertical movement `0 m`, horizontal/vertical scale `1.0` and Reset controls | Controls and values observed only; adjustments were not exercised |
| Views | Bottom 2D/3D toggles switched the same room and sofa between plan and perspective; inset view showed the other projection | Roam was visible, not exercised; do not infer RCP/elevation behavior from labels |
| Camera | Deselected object, then left-dragged clear canvas; the room visibly orbited | Right-drag pan, zoom, Q/E height and saved-camera semantics not verified |
| Saving | Save showed `Saving...`. File → Save As exposed name, privacy, style, room-count fields and neighborhood address; name guidance 3–60 characters; address up to 128 | Disappearing spinner alone was not treated as success |
| Private round-trip | Saved `Cue editor observation test 2026-11-04` with **Private** selected. It appeared in My Designs with a lock icon; reopened its thumbnail; room and sofa returned. Sofa selection again showed blue-axis `45°` and original dimensions | Verified in the same browser/account. Exact camera equality, cross-device persistence, versions and conflict behavior not tested |

Two disposable test entries were created while exercising Save and Save As: **The Bright Minimal Room** and **Cue editor observation test 2026-11-04**. Both displayed lock icons in My Designs. No pre-existing design was opened for editing or deleted.

The follow-up reused **Cue editor observation test 2026-11-04** and explicitly undid both new mutations. No Save/Save As, trial, render or AI job was triggered in this follow-up. Drawing and material drags each returned browser-tool `ACTION_IN_DOUBT`; they were inspected, not blindly replayed or counted as success. Later pointer movement, the completed room/area, the changed 2D/3D texture and material name, and their Undo results provide the actual evidence. Texture/property updates were asynchronous. These findings establish outcomes, not a perfectly replayable input trace or a Homestyler defect.

## Visible controls are not automatically verified features

The Build panel exposed straight-wall drawing; rectangular/L/T rooms; outside areas; doors/windows/corner bay windows; roof, stairs, openings, railing, columns, beams, floor openings, niches, sunken ground and flues. Porch, exterior balcony, indoor pool and Add Floor displayed trial markers. Trial operations were not consumed.

Wall selection exposed thickness/length/height, wall type, load-bearing choice, Auto-connect, Split Wall, Connect Walls, Align, Convert to Arc Wall, Delete and Hide. Sofa selection exposed Replace, Replace Material, Flip, Duplicate, Linear Array, Delete, Hide and Add to Fav. Those commands were inventoried, not all tested.

Top-level controls included File, Save, Undo, Redo, Clear, Construction, Tools, View, AI Tools, Export, Images and Render. File exposed New, Open, Save, Save As, Edit, Share the Design and Version History. The furniture catalog contained room/category navigation, search, size/brand filters, paging and entitlement markers. Counts and catalog contents are volatile, not a fixed inventory or redistribution permission.

The [published feature inventory](https://www.homestyler.com/pricing), [release listing](https://www.homestyler.com/about/updates), and [tutorial index](https://www.homestyler.com/learn/video-tutorials?lang=en_US) additionally describe modeling, cabinetry/MEP, visualization, deliverables, shared organization and AI. These are documentation-based scope leads, not proof of current runtime behavior or exhaustive parity. See the [feature ledger](feature-ledger.csv) for exact observed/blocked distinctions.

## Pixel parity and reference capture

Literal pixel parity needs a frozen version, viewport, DPR, browser/renderer, locale, fonts, catalog state and project state. The visual states inspected here include blank setup, 2D template, selected sofa, flooring catalog, 3D orbit, private Save As and My Designs. The Cloud Browser's ephemeral captures are not a checked-in golden-image suite. A bounded PingFusi comparison was run on a generic two-room 2D overview at 1280 × 649 CSS pixels; it is component geometry evidence, not a full golden-image suite. A user-facing current-editor screenshot accompanies the handoff; no standalone screenshot bundle has been exported.

Before claiming pixel parity, archive authorized reference images for default, hover, selected, disabled, modal, validation, loading and error states. Record action sequence, input values, expected state and legitimate volatile/private exclusions. Compare matched states with overlays and pixel differences. Require zero unexplained differences for the user's literal criterion; do not silently introduce a tolerance. Functional parity needs separate geometry, persistence, export and rendering tests.

## Proposed architecture — not recovered internals

Use a TypeScript application with domain, geometry, rendering, assets and persistence boundaries. Vite/React is a proposed shell; SVG/Canvas2D a proposed plan renderer; Three.js/WebGL2 a proposed perspective renderer. These are independent engineering choices, not assertions about Homestyler's stack. Both views must project one canonical document, never separately maintained geometry.

### Canonical project data

Version serialized projects with stable IDs, explicit display units and schema migrations. Store geometry in a documented canonical unit such as integer millimetres:

- **Project:** schemaVersion, ID, name, units, levels, assets, materials, cameras, render settings, metadata and timestamps.
- **Level:** elevation, height, nodes, wall segments, room boundaries, hosted openings, slabs, ceilings and object instances.
- **Wall:** endpoint node IDs, thickness, height, join rules, side finishes and hosted-opening IDs.
- **Opening:** host-wall ID, offset, width, height, sill, orientation and cut profile.
- **Object:** asset ID, transform, dimensions, elevation, finish overrides and parametric values.
- **Material:** color/PBR maps, scale, offset, rotation, assignment scope and provenance.
- **Camera:** projection, pose/target, FOV, clipping, level and navigation mode.

### Geometry and commands

Use a robust planar graph for intersection, split/merge, shared boundaries, room closure, snapping and dimensions. Handle acute/obtuse/T-junction joins, concave polygons, holes, degenerate segments and self-intersection validation. Derive wall meshes, floor/ceiling slabs and opening cuts from that graph. Recompute measured areas consistently after thickness changes; add the observed 9.45→8→Undo sequence as an acceptance fixture.

Represent edits as reversible commands. One pointer drag should be one undoable action; keep selection, hover, transient previews and navigation separate from document mutations. Run expensive imports and geometry processing in workers. Unit/property tests must verify invariants and cross-view consistency, not only screenshots.

### Assets and materials

Use glTF/GLB assets with dimensions, bounding boxes, thumbnails, LODs and collision proxies. Maintain source/author/license/redistribution records. Validate user imports and texture/geometry resource budgets. Build a redistributable catalog independently; the observed sofa and original catalog are references only, not included assets. A handful of placeholders is not catalog parity.

Persist PBR inputs, UV transforms, surface-side assignments and instance overrides. One Living Room floor-material assignment and Undo are confirmed. Brush/sample semantics, precise surface targeting, per-face assignment, UV adjustments and persistence still require further reference observation. A proposed implementation must not be mislabeled as observed behavior.

### Persistence and outputs

IndexedDB plus versioned downloadable project bundles is a local-first foundation, not equivalent to cloud saving. Cloud parity additionally needs authenticated project/asset storage, ownership, private/public permissions, version history, restore, cross-device reopen and concurrency/conflict policy. Preserve independent account-free local export. Never embed Homestyler credentials or reuse its private service endpoints.

Generate exports from the canonical model. SVG/PDF/CSV/DXF are proposed independently implemented formats; exact target formats still need validation. DWG requires a separately validated technical/licensing route, not a renamed DXF. Test units, layers, dimensions, openings, quantities and round-trip behavior.

### Advanced compute and hosting

Realtime preview is not a replacement for photorealistic rendering. Independent still/panorama/video pipelines, lighting/LightMix-like controls, retouching and AI need their own implementations, licensed inputs, output comparisons, failure/cancel behavior and measured resources. Browser observation does not recover private render workers, AI weights, backend logic or model catalogs.

Vercel is the authorized frontend production destination, with repository `hiruuu30/homestyler_clone` and intended team `hiroo1`. Storage, collaboration, GPU rendering and inference are separate systems. No subscription gates in the new app does not imply unlimited zero-cost infrastructure. Do not purchase services or enable paid resources under the free-only constraint.

## Codex Cloud implementation and release gate

Follow [the detailed implementation plan](CODEX_CLOUD_IMPLEMENTATION_PLAN.md): freeze the finite scope/reference set; build the domain and UI; implement complete plan geometry; derive linked 3D; add licensed assets/materials; implement advanced modules and outputs; add visualization/AI and cloud/collaboration; then release-test.

Maintain `feature-ledger.csv` with evidence, implementation paths, automated and visual checks, and blockers. Do not erase historical evidence, imply CLI success means CDP success, invent recovered internals, use inert controls as functionality, or call an intermediate phase a complete clone.

The user has now permitted incremental implementation while original catalog assets are deferred; this work does not waive strict full-functional and pixel-level parity as the final target. The user also explicitly authorized release of the incomplete prototype, which is not a complete-clone acceptance decision. Before claiming a complete production clone, establish a sufficiently comprehensive authorized reference; define a finite, evidence-backed feature/state acceptance matrix; demonstrate a technically and legally viable route for every capability; identify independently usable/licensed assets and services; and document the test matrix and required resources. If any material scope remains unsupported, report the blocker. The complete build must also pass geometry/property tests, import/export round trips, save/reopen and recovery tests, browser E2E workflows, zero-unexplained-difference matched-state visual comparisons, accessibility/performance/security checks and license/resource audits. The prototype deployment is READY for the stated commit and canonical URL; basic load checks do not pass the full-parity gates, and the current prototype has passed no full-parity acceptance suite.

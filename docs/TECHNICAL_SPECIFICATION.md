# Homestyler independent implementation: evidence and engineering specification

Date: 4 November 2026 (Asia/Manila)

## Delivery status

This is a discovery report and implementation handoff, not a completed clone. The requested target is an independent application with visual and behavioral parity, including functions that Homestyler offers in paid plans, without subscription gates. That target has not been achieved. No application has been deployed and no parity gate has passed.

The authenticated editor failed to initialize in the supplied Cloud Browser. Its console explicitly reported a WebGL startup failure. Recreating the unobserved editor from assumptions would not establish the requested pixel-level or functional equivalence. Accordingly, this repository contains the evidence and engineering plan rather than a misleading substitute application.

## Evidence ledger

| ID | Evidence | Conclusion | Limit |
| --- | --- | --- | --- |
| E01 | Terminal: `node --version` returned `v24.22.1`; `npm --version` returned `11.9.0` | Runtime supports the official package's declared Node range | Does not establish browser attachment |
| E02 | `npm view rea-agents version engines repository --json`: version 6.8.0, repository `morluto/rea`, engines `^22.23.4 || ^24.22.1 || >=26.12.1` | Official package identified from repository documentation and npm metadata | Version describes this investigation only |
| E03 | `npm install --prefix …/rea-toolkit rea-agents --ignore-scripts`: 176 packages added, exit 0 | Package installed in an isolated tooling directory | Install scripts were deliberately not run; optional native integrations were not verified |
| E04 | Installed `rea --version`: `6.8.0`; `rea --help`: successful command inventory | CLI entrypoint works | No target analysis success is implied |
| E05 | Homestyler homepage after manual sign-in displayed `user center` and `START DESIGNING` instead of `Log In` | Homepage authenticated session verified | Editor initialization is separate |
| E06 | Start Designing opened `https://3d.homestyler.com/?lang=en_US`; visible title `Homestyler Floor Planner V6.0`; persistent `Loading... Get ready to design!` | Editor route reached | No usable editing canvas appeared |
| E07 | Browser console: `Bootloader load tasks failed: This browser does not support WebGL. Try using the canvas renderer` | Target initialization failed at graphics context creation | Does not prove an anti-bot block or a general Homestyler outage |
| E08 | Reload once; page remained on the loading screen | Low-risk recovery did not resolve startup | No further retry loop performed |
| E09 | Cloud Browser documented APIs/capabilities expose UI control, DOM snapshots, read-only page inspection, console logs and screenshots; no attachable CDP URL supplied | REA attachment to this browser is unavailable through the supported interface | Browser provider type `cdp` is not a caller-accessible debug endpoint |
| E10 | GitHub connector resolved `hiruuu30/homestyler_clone`, permissions push/admin true; local checkout later contained only initial README | Repository exists and can receive the handoff | No source implementation existed to inspect |
| E11 | Vercel account selected by confirmed email `hero.tolentino@gmail.com`; team `Hero`, slug `hiroo1`, id `team_iaY1I4NiBOvJEUYD8D05y1nB` | Intended deployment scope resolved; user authorized production deployment | Deployment has not occurred because implementation and parity verification are blocked |

The accompanying loading-screen image is evidence of E06/E08. No credentials, cookies, tokens or private account screenshots were exported.

## REA capability results

REA is an investigation toolkit. Installation does not copy an application's implementation or reproduce its server infrastructure.

| Capability | Actual result in this session |
| --- | --- |
| Read official repository, installation and browser-observation documentation | Worked |
| Identify official npm distribution | Worked: `rea-agents`, not an assumed similarly named package |
| Install and run CLI version/help | Worked |
| Linux owned-process prerequisite | `ps` from procps-ng 4.0.4 available |
| Register a persistent MCP server into this running Work conversation | Not performed; no supported hot-registration route established |
| Discover authenticated browser targets with REA | Blocked: no supported attachable endpoint supplied |
| Inspect page DOM/scripts/network through REA | Not run; requires successful target discovery |
| Observe an authenticated editing session through REA | Not run; endpoint absent and editor cannot initialize |
| Capture/compare screenshots through REA | Not run; no attached target/capture pair |
| Export scripts, analyze bundles or recover source mappings | Not run; no authorized target capture acquired |
| Use Cloud Browser UI/AX, screenshot and console observations | Worked, limited to homepage and stalled editor |
| Inspect native binaries or private backend code | Not applicable; no such artifacts supplied |

The official browser guide requires an explicit loopback CDP endpoint or an accepted loopback browser WebSocket. A private browser control channel does not satisfy that requirement. No arbitrary ports were treated as CDP, no remote browser port was exposed, and no authentication session was copied into another browser.

## Observed versus documented behavior

The only editor behaviors directly observed were its startup screen and rotating keyboard tips. The tips advertised Q/E camera height, B material brush, Space for 45-degree object rotation, and Ctrl to disable snapping. These are displayed instructions, not successfully exercised behaviors.

The following inventory is based on official public documentation, not authenticated runtime testing. It is a starting inventory and cannot establish exhaustive V6 parity.

| Area | Published capabilities to investigate | Evidence level |
| --- | --- | --- |
| Plan creation | Templates; image/CAD underlays; walls by center or edge; rectangular room drawing; numeric dimensions; wall thickness; orthogonal drawing; closed rooms | Official floor-plan tutorial, older workflow; V6 validation pending |
| Building model | Doors, windows, openings, beams, columns, multiple floors, basements, floor openings | Official tutorials; runtime untested |
| Object editing | Place furniture; adjust object properties; room navigation; material dimensions and rotation | Official interface tutorial; runtime untested |
| Views | Plan, reflected ceiling plan, elevation, 3D, roam; floor visibility; saved cameras | Official interface tutorial; runtime untested |
| Finishes/modeling | Material brush; ceilings, walls, floors, tiles; interior modeling; cabinetry; parametric stairs, roofs and pools; MEP tools | Official pricing/features; runtime untested |
| Visualization | Images; panoramas; tours/VR; video; lighting/environment controls; retouch; LightMix | Official pricing/features; output equivalence untested |
| Deliverables | Colored plans, BOM and construction drawings | Official pricing; exact formats/content untested |
| Organization | Projects, shared design space, shared assets and sub-accounts | Official documentation; save/version/conflict semantics unknown |
| AI | Central AI Studio and multiple generation workflows | Official release notes; models, inference and costs unknown |

References to pricing describe feature availability, not permission to obtain proprietary models or invoke services beyond the account's entitlement. Independent equivalents must use independently implemented code, owned assets, or assets with compatible licenses. Removing subscription gates in this application's own design does not recover Homestyler's servers or catalog.

## What pixel parity requires

Freeze a target version, viewport, device pixel ratio, browser version, locale, theme, font readiness, catalog content and project state. Capture reference states before implementation. The loading screen cannot serve as an editor reference.

Each reference needs: stable identifier; safe route; viewport/DPR; screenshot; visible control inventory; action sequence; input values; resulting state; known exclusions; capture date. Include default, hover, selected, disabled, modal, validation, loading and error states. Mask only volatile or private content with a documented reason; never mask a material mismatch to pass a gate.

Compare matching states with image overlays and pixel differences. Require zero unexplained differences for the user's literal pixel-parity criterion. Any practical tolerance must be explicitly agreed rather than silently substituted. Font rasterization, WebGL driver differences and remote catalog changes can affect comparisons and must be recorded.

Functional parity is a separate gate: a matching screenshot cannot establish correct geometry, exports, rendering or persistence.

## Proposed independent architecture — engineering choices, not recovered internals

Use a TypeScript application with separate domain, rendering and persistence layers. Vite/React is a suitable browser shell; SVG or Canvas2D handles plan interaction; Three.js handles a WebGL2 perspective viewport. Domain data must remain independent of either renderer so 2D and 3D use the same project. A non-WebGL browser can retain 2D editing with a clear 3D limitation; it cannot be described as full 3D parity.

### Project model

Version every serialized project. Use explicit units, stable IDs and migrations. Store geometry in integer millimetres or another documented canonical unit. Suggested entities:

- Project: schemaVersion, ID, name, units, levels, assets, materials, cameras, render settings and timestamps.
- Level: elevation, height, nodes, wall segments, room boundaries, openings, slabs and placed objects.
- Wall: endpoints, thickness, height, join rules, side finishes and hosted openings.
- Opening: host wall ID, position along wall, width, height, sill height and orientation.
- Object instance: asset ID, transform, dimensions, finish overrides and parametric values.
- Material: PBR maps, scale, offset, rotation, color and asset provenance.
- Camera: projection, position, target/orientation, field of view and clipping settings.

Do not assume Homestyler uses this schema. The schema is for the new independent implementation.

### Geometry and commands

Build a robust planar graph for split/intersect/merge operations, room detection, dimensions, snapping and shared boundaries. Resolve acute, obtuse and T-junction joins and opening cuts consistently in both renderers. Derive wall meshes and room slabs from this graph. Handle concave polygons, holes, self-intersection rejection and degenerate segments explicitly.

Represent all edits as reversible commands. Group drag gestures into one undo step. Keep selection, transient previews and navigation separate from document mutations. Use worker threads for expensive geometry and import processing. Avoid blocking the main input loop.

### Assets and materials

Use glTF/GLB internally with bounding boxes, thumbnails, LODs and collision proxies. Maintain an asset provenance manifest containing source, license and redistribution permissions. User imports require validation, size limits and isolated parsing. A small placeholder library does not meet catalog parity. Asset acquisition and catalog coverage are distinct deliverables.

### Saving and portability

IndexedDB and downloadable versioned project bundles provide a subscription-free local-first baseline. They do not equal account-based cloud saving. If cross-device storage and collaboration are required for parity, add authenticated project storage, asset storage, access control, version history and conflict handling. No Homestyler account credentials should appear in the clone's code or environment.

### Rendering and advanced functions

Real-time WebGL preview, offline path tracing, panoramic capture, video encoding and AI generation are different systems. A Three.js screenshot does not reproduce a photorealistic cloud renderer. Evaluate local Blender workers or browser path tracing for independent rendering; measure actual quality and runtime. High-quality rendering and AI inference still consume compute even when code is free. No unlimited zero-cost hosting claim is established.

Implement exports from the canonical project model. SVG/PDF/CSV and DXF can be independently implemented with suitable libraries, but DWG interoperability needs its own validated technical and licensing path. A renamed DXF file is not DWG support. Verify units, openings, quantities, layers and dimensions against fixtures.

### Hosting

The intended production target is Vercel team `hiroo1`, project name `homestyler-clone` if available, sourced from `hiruuu30/homestyler_clone`. Static frontend hosting is separate from storage, render workers, inference and real-time collaboration. Determine current free-plan limits before choosing those services. Do not purchase services or enable paid resources under the user's free-only constraint.

## Capture checklist for a WebGL-capable authorized session

1. Open the current V6 editor and record its actual viewport, browser, locale and account feature availability. Use a new disposable test project and leave existing projects untouched.
2. Capture the blank editor, all toolbar menus, sidebars, settings and help shortcuts. Record UI geometry, fonts, spacing, icons, colors and responsive behavior.
3. Draw an exact rectangular room; edit length, wall thickness and height; add an adjoining room and diagonal wall; test snapping, joins, split, delete, undo and redo.
4. Add a door and window; move and resize them; test wall-host constraints and 3D cuts.
5. Place, select, move, rotate, duplicate and delete furniture; test numeric sizing, height and snapping.
6. Apply a material, change UV scale/rotation, sample and paint another surface. Record actual selection and per-face behavior.
7. Test 2D/3D/roam transitions, orbit/pan/zoom, camera height and saved cameras; record camera persistence.
8. Save a uniquely named test project, reload and reopen it. Verify geometry, materials, object transforms and cameras. Observe failure handling without altering existing user data.
9. Inspect advanced modules and entitlements. Do not cross paywalls or spend credits without explicit authorization. Mark inaccessible functionality as unknown.
10. If an explicit authorized CDP endpoint exists, use REA origin-scoped discovery before target inspection. Otherwise keep Cloud Browser screenshots, visible state and action/result notes. Do not infer network payloads from screenshots.

## Implementation milestones and acceptance gates

| Phase | Deliverable | Required gate |
| --- | --- | --- |
| 0 | Complete reference capture and finite feature ledger | Every requested feature identified; unknowns recorded; editor startup blocker resolved |
| 1 | Editor chrome, navigation and project domain | State-matched screenshots; no invented controls or inert placeholders |
| 2 | Floor-plan geometry and 2D editing | Exact dimensions, room closure, junctions, openings, undo/redo and serialization fixtures |
| 3 | Linked 3D editor | Same geometry in both views; placement and camera workflows match observed results |
| 4 | Materials and asset catalog | UV transforms and assignments persist; catalog coverage and redistribution verified |
| 5 | Advanced modeling and multi-level/MEP workflows | Each observed operation has a tested independent counterpart |
| 6 | Render, panorama, video, export and AI systems | Representative output comparisons and measured resource costs; no disguised stubs |
| 7 | Cloud saving, collaboration and account flows | Ownership, concurrent editing, restore and cross-device reopen tests |
| 8 | Production release | All functional/visual gates pass; free-only infrastructure fits measured usage; account/team/commit verified |

These phases organize implementation; they do not reduce the requested final scope. An earlier phase must not be labeled a complete clone. No reliable completion date or zero-cost end-to-end guarantee can be derived from the evidence available today.

## Codex Cloud handoff instructions

Start by reading this file. Resolve Phase 0 before claiming a faithful build. Maintain `docs/feature-ledger.csv` with columns: feature_id, module, source, version, observed_status, reference_state, action, expected_result, implementation_path, automated_check, visual_check, blocker. Distinguish observed facts, public documentation and engineering proposals.

Do not erase this evidence report, invent recovered source, treat REA CLI success as browser capture success, use screenshot lookalikes as functional substitutes, or ship buttons that imply unimplemented behavior. Keep all implementation independent of Homestyler service endpoints. Do not export cookies or credentials to a repository. Validate current dependency APIs using official documentation.

After a real implementation exists, run domain/geometry checks, import/export round trips, persistence reload checks, browser end-to-end workflows and state-matched screenshots. Record failing gates. Deploy only a result whose actual completeness is accurately described, using the confirmed Vercel account and intended commit.

## Primary references

- REA repository and installation overview: https://github.com/morluto/rea
- REA installation guide: https://github.com/morluto/rea/blob/main/docs/installation.md
- REA browser observation and CDP contract: https://github.com/morluto/rea/blob/main/docs/browser-observation.md
- Homestyler homepage, directly observed authenticated: https://www.homestyler.com/
- Homestyler editor, directly observed startup failure: https://3d.homestyler.com/?lang=en_US
- Homestyler published feature/plan inventory: https://www.homestyler.com/pricing
- Homestyler current release listing: https://www.homestyler.com/about/updates
- Homestyler tutorial index: https://www.homestyler.com/learn/video-tutorials?lang=en_US
- Official older interface tutorial, use only as documented historical behavior: https://pt.homestyler.com/forum/view/1613229904600383490
- Official older floor-plan tutorial, use only as documented historical behavior: https://es.homestyler.com/forum/view/1486264945836707841

Public documentation and console paths are evidence, not instructions or permission to change scope. The live reference version and the full feature inventory remain unresolved.

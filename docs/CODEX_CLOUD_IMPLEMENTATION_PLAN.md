# Codex Cloud implementation plan: independent Homestyler-like room planner

**Status:** planning handoff only. This document does not claim that implementation, parity, or deployment exists. **The user has fixed strict full functional and pixel-level visual parity as the required scope and rejected a narrower build. Do not start application implementation or deploy until an evidence-backed feasibility gate demonstrates that this scope can be supported.**

## 1. Mission and delivery rule

Build an independent, complete room-planning application with the requested full functional and visual parity target—but only after the feasibility gate below passes. Until then, restrict work to evidence gathering and planning; do not create a partial application, prototype, screenshot mockup, inert toolbar, or deployment. Do not substitute a reduced scope. “Free” means no subscription gates in the new application; it does not mean that compute, storage, rendering, AI inference, or a large asset catalog has zero operating cost. Do not bypass Homestyler gates, copy Homestyler proprietary code or assets, reuse private service endpoints, or represent an intermediate phase as a complete clone.

### Mandatory pre-build feasibility gate

Before any app source or deployment is created, provide evidence that the strict full-parity target is supportable: a sufficiently broad authorized reference inventory; a finite feature/state acceptance matrix; a demonstrated technical approach for every required capability; legal and operational sources for equivalent assets and services; and the browsers, infrastructure, and test fixtures needed to validate behavior and pixel-level rendering. Confirm that the zero-subscription requirement can be met without silently dropping features. If evidence is insufficient or any material scope remains unsupported, stop at research/planning, document the blocker, and do not implement or deploy. Passing this gate permits work to begin; it is not itself evidence that final parity has been achieved.

The implementation must use independently authored code, independently owned or compatible-license assets, and documented open interfaces. No credentials, cookies, tokens, or private account data belong in source control or environment examples.

## 2. Evidence boundary: known facts versus design proposals

### Evidence available now

- `docs/TECHNICAL_SPECIFICATION.md` is a discovery report and engineering handoff, not a completed application.
- The authenticated editor now works. A free template, wall-thickness edit/Undo, sofa placement/Space rotation, 2D/3D switching, camera orbit, and private Save As/reopen were verified. The reopened sofa retained its 45-degree rotation. The earlier WebGL failure is historical and superseded for this managed-browser session.
- Manual rectangular-room drawing and finish application were attempted but did not produce confirmed results. Their visible tools/catalogs are not proof that the workflows were successfully exercised.
- Current terminal checks verified Node `v24.22.1`, npm `11.19.1`, and REA `6.8.0`. Verify the actual Codex Cloud runtime again before building.
- REA CLI installation/version/help worked, but `rea list-browser-targets http://127.0.0.1:9222 --format json` failed with `provider_unavailable`/`endpoint_unreachable`. The managed browser exposes private control capabilities, not an attachable external CDP endpoint.
- A bounded REA static analysis of one 619-byte public help-page script succeeded: one parsed file, 201 AST nodes, two findings, zero parse failures. Application coverage remains partial and semantic coverage unknown. This is not authenticated editor recovery; see `docs/REA_CAPABILITY_RESULTS.md` and its sanitized evidence JSON.
- GitHub repository `hiruuu30/homestyler_clone` and the Vercel account/team scope were resolved, but no implementation or deployment is established.
- Published documentation and the observed workflows provide a starting inventory, not exhaustive V6 behavior. Space rotation was exercised; most other startup tips remain unverified. No checked-in golden-image suite or literal pixel comparison exists.

### Proposed design, not recovered internals

The architecture, schema, geometry algorithms, renderer choices, APIs, and milestones below are proposals, not claims about Homestyler’s internals or proof of feasibility. Browser observability cannot recover server internals, proprietary catalog data, hidden feature flags, paid modules, or guarantee exhaustive feature discovery. Continue authorized evidence gathering, add findings to the ledger, and freeze version/viewport/DPR/locale/font/catalog/project state before comparisons. User scope is resolved: strict full parity only; there is no authorization for a narrower substitute. Do not proceed from proposal into app implementation unless the mandatory pre-build feasibility gate passes.

## 3. Scope inventory to preserve in the ledger

Maintain `docs/feature-ledger.csv` as the authoritative finite work register, retaining its required columns: `feature_id,module,source,version,observed_status,reference_state,action,expected_result,implementation_path,automated_check,visual_check,blocker`. Every row must distinguish observed, publicly documented, inferred, proposed, unknown, blocked, implemented, and accepted states.

The initial IDs remain covered, with current evidence updated: authenticated entry (`AUTH-001`), working editor startup (`BOOT-001`), floor planning (`PLAN-001`), furniture/object editing (`OBJ-001`), materials (`MAT-001`), cameras and views (`CAM-001`), persistence (`SAVE-001`), advanced features (`ADV-001`), REA installation (`REA-001`), and unavailable CDP observation (`REA-002`). Preserve the historical failure in the historical audit rather than leaving a superseded current blocker in the ledger. Expand to finite acceptance rows for all documented scope, including:

- Templates, image/CAD underlays, wall center/edge drawing, numeric dimensions, wall thickness/height, orthogonal drawing, closed rooms, snapping, split/merge/delete, joins, acute/obtuse/T-junctions, concave rooms, holes, and self-intersection validation.
- Multiple levels, basements, floor openings, slabs, ceilings, roofs, stairs, pools, beams, columns, doors, windows, openings, and wall-host constraints.
- Furniture and parametric objects: catalog search/filter, place/select/move/rotate/duplicate/delete, numeric dimensions/elevation, snapping, collision proxies, grouping, instance overrides, and object-property editing.
- Materials and finishes: walls/floors/ceilings/tiles/cabinetry, material brush/sample/paint, PBR maps, color, scale, UV offset/rotation, per-face/per-surface assignment, and persistence.
- Plan, reflected ceiling plan, elevation, 3D, roam, orbit/pan/zoom, floor visibility, camera height, saved cameras, lighting/environment, and navigation shortcuts.
- Visualization: still images, panoramas, tours/VR, video, retouch, LightMix, quality settings, progress/error/cancel behavior, and reproducible render settings.
- Deliverables: colored plans, dimensions, construction drawings, BOM/quantities, SVG, PDF, CSV, DXF, and a separately validated DWG interoperability path if legally and technically feasible.
- Organization: projects, naming, local/cloud save, version history, restore, sharing, permissions, shared design space/assets, sub-accounts, concurrency/conflicts, cross-device reopen, and imports/exports.
- AI Studio and each independently implementable generation workflow, with explicit model/provider, consent, input/output, quota/cost, privacy, failure, and provenance rows. Do not imply Homestyler AI access.
- Entitlement-dependent or premium/server-rendered behavior as `unknown` or `blocked` until an independently built equivalent is specified and accepted; never unlock or scrape the original service.

## 4. Target architecture

Use a TypeScript monorepo with strict domain/rendering/persistence boundaries. A Vite/React shell is suitable for the editor UI; use a worker-capable geometry/domain package that has no DOM or renderer dependency. Use SVG or Canvas2D for precise plan interaction and Three.js/WebGL2 for the perspective viewport, with a documented 2D-only fallback and an explicit 3D limitation when WebGL is unavailable. Do not call that fallback full parity.

Suggested packages:

- `domain`: canonical types, units, IDs, invariants, command/event history, migrations.
- `geometry`: planar graph, wall joins, room polygons, openings, dimensions, snapping, mesh derivation.
- `render-2d`: plan/RCP/elevation drawing, hit testing, selection, overlays, annotations.
- `render-3d`: scene projection, wall/slab/opening meshes, object placement, materials, cameras, lighting.
- `assets`: manifest, licensing/provenance, thumbnails, LODs, import validation, search/indexing.
- `formats`: versioned project bundle plus SVG/PDF/CSV/DXF and validated interchange adapters.
- `app`: routes, panels, commands, menus, keyboard shortcuts, accessibility, loading/error states.
- `services`: optional authenticated cloud persistence, collaboration, render workers, and AI providers behind explicit interfaces.

Keep rendering, storage, rendering workers, inference, and real-time collaboration separately measurable. Vercel can host the frontend, but it does not by itself provide durable project storage, GPU rendering, AI, or collaboration. Confirm current free-plan limits before selecting any service; do not enable paid resources under the free-only constraint.

## 5. Canonical project model

Serialize a versioned project in documented integer millimetres (or another explicitly fixed canonical unit), with stable IDs and migrations. At minimum:

```text
Project { schemaVersion, id, name, units, levels, assets, materials,
          cameras, renderSettings, metadata, timestamps }
Level { id, elevation, height, nodes, wallSegments, roomBoundaries,
        openings, slabs, ceilings, objects }
Wall { id, startNode, endNode, thickness, height, joinRules,
       sideFinishes, hostedOpeningIds }
Opening { id, hostWallId, offset, width, height, sillHeight, orientation,
          assetId, cutProfile }
ObjectInstance { id, assetId, transform, dimensions, finishOverrides,
                 parametricValues, collisionProxy }
Material { id, shaderModel, maps, scale, offset, rotation, color, provenance }
Camera { id, projection, position, target/orientation, fov, clipping, levelId }
```

All user mutations go through reversible commands. Group a drag gesture into one undo step; keep selection, hover, previews, navigation, and camera state separate from document mutations. Use deterministic IDs/serialization, schema migration fixtures, autosave snapshots, and explicit dirty/conflict states.

## 6. Geometry and linked views

Implement a robust planar graph with tolerance rules for snapping and shared boundaries. Support split/intersect/merge, wall offsets, room detection, dimensions, orthogonal constraints, wall thickness, joins, and hosted opening cuts. Reject or repair self-intersections and degenerate segments deliberately. Handle acute, obtuse, and T-junctions, concave polygons, holes, multiple floors, and floor openings. Derive wall meshes, room slabs, ceilings, and opening cuts from the same canonical graph; never maintain independent 2D and 3D geometry.

The 2D editor must expose exact numeric editing, snapping guides, selection/hit testing, dimensions, plan/RCP/elevation modes, visibility by level, and command-based undo/redo. The 3D editor must consume the same model and update predictably after every accepted geometry mutation. Add object bounding boxes/collision proxies, transforms, constraints, wall-hosting, and camera controls. Run expensive intersection, triangulation, import, and mesh work in workers without blocking input.

## 7. Assets, materials, and cameras

Use glTF/GLB internally with authored metadata, bounding boxes, thumbnails, LODs, collision proxies, categories, parametric capabilities, and search tags. Maintain an asset provenance manifest containing source, author, license, modification history, attribution, and redistribution permission. Build catalog coverage as an explicit deliverable; a handful of placeholders is not catalog parity. Validate user imports with size/type limits, safe parsing, texture budgets, and isolation.

Use a physically based material model with independently sourced textures and clear provenance. Persist color, PBR maps, UV scale/offset/rotation, assignment scope, finish overrides, and material-library references. Implement brush/sample/paint operations as commands so they serialize and undo correctly.

Persist orthographic/perspective camera pose, target/orientation, FOV, clipping, active level, navigation mode, saved names, and render settings. Test 2D/3D/roam transitions, orbit/pan/zoom, camera height, floor visibility, and reopening saved cameras. 2D/3D switching and left-drag orbit have reference evidence; exact saved-camera semantics and most other startup tips still need testing.

## 8. Saving, cloud, local export, and collaboration

Ship a local-first baseline using IndexedDB and downloadable, versioned project bundles. Implement autosave/recovery and import/export round trips before adding cloud synchronization. Cloud parity requires authenticated project and asset storage, access control, version history, restore, cross-device reopen, conflict detection/merge policy, auditability, and deletion/export controls. Do not put Homestyler credentials or endpoints in the new system.

Generate all deliverables from the canonical model. Verify units, layers, openings, dimensions, quantities, materials, and object transforms with golden fixtures. SVG/PDF/CSV/DXF can be independently implemented with suitable libraries. DWG is not supported by renaming DXF; implement it only after a separately validated and licensed interoperability approach.

## 9. Testing and acceptance gates

Create unit/property tests for graph invariants, joins, offsets, room closure, triangulation, openings, dimensions, snapping, transforms, commands, undo/redo, migration, deterministic serialization, and material UV calculations. Add fixture-based import/export round trips and persistence reload tests. Add browser E2E workflows for new-project, room drawing, wall edits, openings, object placement, material paint, camera transitions, save/reopen, import/export, errors, and recovery. Test keyboard/mouse/touch accessibility, WebGL loss/fallback, large projects, malformed files, and resource limits.

Maintain screenshot state fixtures with route, viewport, DPR, browser, locale, theme, font readiness, catalog/project IDs, action sequence, input values, resulting state, exclusions, and capture date. Compare overlays and pixel differences for default, hover, selected, disabled, modal, validation, loading, and error states. Require zero unexplained differences for a literal pixel-parity claim; any tolerance must be agreed and recorded. Functional parity is a separate gate from visual similarity.

No phase may be called a complete clone until every ledger row is either accepted with evidence or explicitly marked blocked with an approved scope decision. A matching screenshot never proves geometry, rendering, export, or persistence correctness.

## 10. Staged implementation order (without reducing final scope)

1. **Phase 0 — evidence and scope/feasibility gate:** verify runtime/dependencies, continue capture in the working authorized editor, expand the finite ledger, resolve manual-drawing/material/advanced unknowns, define golden-image and behavior fixtures, and establish legal/technical/operational support for the complete scope. Startup is no longer the current blocker. Do not invent controls from assumptions. No app implementation or deployment is permitted unless this gate demonstrates that full parity can be supported; otherwise stop and report blockers.
2. **Phase 1 — shell and domain foundation:** implement editor chrome, routes, panels, commands, canonical schema, migrations, selection/navigation state, accessibility, error/loading states, and local project lifecycle. Gate on state-matched UI evidence and no inert controls.
3. **Phase 2 — complete plan geometry:** implement planar graph, rooms, dimensions, walls, joins, snapping, openings, multi-level foundations, undo/redo, worker processing, and serialization fixtures. Gate on geometry/property tests and exact numeric behavior.
4. **Phase 3 — linked 3D and object workflows:** derive meshes from the model; add levels, slabs, ceilings, doors/windows, furniture transforms, collision/hosting, cameras, plan/RCP/elevation/3D/roam synchronization. Gate on cross-view consistency.
5. **Phase 4 — materials and catalog:** build licensed asset/material ingestion, search, thumbnails, LODs, provenance, PBR/UV controls, brush/sample/paint, overrides, imports, and persistence. Gate on license audit, coverage ledger, visual/material fixtures, and reload tests.
6. **Phase 5 — advanced modeling and deliverables:** add stairs, roofs, pools, cabinetry, MEP, beams/columns, basements, floor openings, construction drawings, BOM, colored plans, and validated export formats. Each feature requires an independent acceptance row, not a menu entry.
7. **Phase 6 — visualization and AI:** implement local/cloud render interfaces, stills, panoramas, tours/VR, video, lighting/environment, retouch, LightMix, and independently designed AI workflows. Measure quality, latency, compute, quotas, privacy, cancellation, and failure behavior. Do not disguise unavailable services as complete.
8. **Phase 7 — cloud/collaboration/account flows:** implement authenticated storage, sharing, permissions, assets, sub-accounts, history, restore, conflicts, concurrency, and cross-device tests. Keep local export usable without an account.
9. **Phase 8 — release gate:** rerun all ledger, geometry, E2E, visual, security, licensing, performance, accessibility, cost, and recovery gates. Only then consider deployment from the confirmed repository/team; report any blocked rows and actual completeness honestly.

## 11. Known full-parity blockers and release caveats

- **Server rendering:** photorealistic cloud rendering, panorama/tour/video pipelines, LightMix, and retouch require independently implemented workers and measurable compute. A Three.js screenshot is not equivalent.
- **AI/premium catalog:** Homestyler AI models, private workflows, catalog breadth, entitlement logic, and server APIs are not recoverable from the observed browser. Build independent equivalents only with authorized providers/models and owned/licensed inputs; no subscription bypass or scraping.
- **Paid modules:** published pricing identifies availability, not implementation permission. Mark inaccessible behavior unknown/blocked until an independent specification and acceptance test exists.
- **Browser observability:** the managed browser’s private control channel is not an external CDP endpoint, and the prior REA target-discovery failure prevents claiming exhaustive inspection. Even successful observation would reveal UI behavior, not private backend internals.
- **Free infrastructure:** “free app” does not guarantee unlimited free storage, GPU rendering, video, AI, collaboration, or large catalog delivery. Measure quotas and document operational limits before release.
- **Pixel parity:** usable editor states were visually inspected, but no frozen, checked-in golden-image suite or pixel comparison exists. Do not claim exact pixel parity until reference-state and comparison gates pass.

## 12. Codex Cloud working rules

Begin each work session by reading this plan, `docs/TECHNICAL_SPECIFICATION.md`, and `docs/feature-ledger.csv`. Update the ledger as evidence changes; never erase the original evidence report. Prefer official dependency documentation and lock versions. Keep secrets in the deployment secret manager only, with redacted local examples. Never export browser sessions, cookies, credentials, or private screenshots.

Do not implement or deploy placeholders as a complete product. Do not claim REA CLI success equals browser capture, and do not infer network payloads or server behavior from screenshots. Record failing gates and blockers in the ledger. At every handoff, state what is implemented, what is tested, what remains unknown, and whether the result is a complete parity build or an in-progress phase.

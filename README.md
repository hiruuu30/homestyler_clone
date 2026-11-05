# Independent Homestyler clone prototype

**Status:** ongoing, independently authored prototype on `hiruuu30/homestyler_clone` main. The current milestone adds explicit-save 3D camera persistence and a transient, snap-aware 2D ruler to the existing room-constrained furniture placement, duplication and atomic-array work, alongside linked floor voids, the measured command bar, active-floor bulk clearing, independent ceiling-pattern mapping and along-wall opening dragging. The public alias is [homestyler-clone.vercel.app](https://homestyler-clone.vercel.app/); its status is not rechecked for this GitHub-only increment. This is not a complete clone or a full-parity claim. Original catalog assets remain deferred.

## Current milestone: command bar and active-floor clearing

The command order and desktop geometry were measured from the authenticated reference editor: File, Save, Undo, Redo, Clear, Construction, Tools, View, AI Tools, Export, Images and Render. At a 1280×649 viewport the central bar is positioned at x335.3125/y0 and measures 609.375×45 pixels. Its File menu is at x342.3125/y49.578125 and measures 168×262 pixels, with the observed row heights and separators. Chromium checks these bounds numerically. Glyphs, fonts, every menu's content and the complete interface are **not** certified pixel-identical.

Supported menus invoke real local project import/save/JSON-copy actions, drawing and furniture tools, visibility recovery, 2D/3D view controls, and SVG/CSV/JSON exports. Save is local browser storage; Save As downloads a JSON copy, not a cloud project duplicate. Unimplemented cloud sharing/history, AI tools, image libraries, rendering and other advanced actions are disabled rather than simulated. Dropdowns support keyboard navigation, disabled-item skipping, Escape, outside dismissal and narrow-viewport positioning.

Clear Furniture, Clear Interior Finish and their combined command affect **only the active floor**. Finish clearing resets procedural floor/ceiling mappings, removes ceiling color assignments and restores generic neutral wall/floor materials. Geometry, openings, furniture colors during a finishes-only clear, and other-floor objects/finishes remain intact. Each command is one Undo/Redo step and persists through explicit Save/reload. Custom colored material IDs are not mistaken for neutral defaults or overwritten.

## Ceiling mapping and opening movement

A room's ceiling has a separate material assignment and independent generic wood/tile mapping: color overlay, rotation, horizontal/vertical offsets and independent X/Y scale. Select Floor or Ceiling in Finishes to edit that surface. Ceiling textures render in 3D and export as SVG metadata without changing the 2D floor fill. Unit conversion preserves physical offsets; older projects default to no ceiling pattern. This is procedural generic rendering, not Homestyler's textured/PBR material system.

In 2D Select mode, drag a hosted door/window along its wall to change its normalized position. Movement previews and clamps to the host wall; the existing model validation rejects invalid opening conflicts. A completed move is one undoable edit and survives local Save/reload. Corresponding full reference behavior remains unverified.

## Structural openings across floors

Select a room, choose an upper floor, and trace a polygon to create a linked floor-surface void on the source floor and every intervening floor through the target. The footprint must fit fully inside exactly one room on each level; grouped removal, Undo/Redo, JSON save/reload, unit conversion, and participating-floor deletion preserve the link. The 3D viewport still shows one active floor at a time: this does not add stair geometry, guards/framing, shaft walls, or a simultaneous stacked-floor view. No matched Homestyler structural-opening reference was available, so this is an independent generic feature, not a behavior or visual-parity claim.

## Constrained furniture placement

Dragging a furniture object in 2D or 3D snaps its center to a local 10 cm grid when the cursor lands within tolerance. New moves and numeric position, width, depth, or plan-rotation edits must keep the rotated footprint fully inside its assigned room on its existing floor, outside room holes, away from wall thickness, and clear of other visible furniture. Hidden furniture does not block placement. Invalid drag previews turn red; dropping there leaves the project and undo history unchanged. Valid moves remain one shared Undo/Redo edit.

Duplicate tests a deterministic set of adjacent positions in increasing center-to-center distance and uses the first one that passes the same room, floor, hole, wall-clearance, and visible-object checks. If none of the tested positions fits, it makes no change. A linear array validates each successive copy against the original project and previously staged copies; if any copy is invalid, the whole array is rejected. A successful duplicate or array is one Undo/Redo step and is saved through the same local project store.

These are conservative rules for this independent editor, not recovered Homestyler semantics. The editor does not automatically reassign rooms or repair legacy placements; existing stored placements remain untouched until edited. Exact visual and behavioral parity is unverified.

## 2D ruler measurements

Choose **Tools → Ruler**, then click two plan points. Each point snaps using the editor's existing wall/room endpoint-first and edge-projection policy; the live line and distance label use the active project unit. A third click starts a new measurement, and Escape clears it. The overlay is temporary: it does not change project geometry, selection, Undo/Redo, local saves, or exports. This is a generic local tool; Homestyler's exact ruler gestures, formatting, persistence, and visual treatment have not been compared.

## Saved 3D camera views

Orbit with a drag, pan with Shift-drag, and zoom with the wheel. The camera target, distance, azimuth, and elevation remain navigational state: gestures create no geometry change or Undo entry, but mark the project unsaved. **Save** and **Save As** persist the camera locally; switching between 2D/3D or reopening a saved project restores it. Fit View clears the custom camera, and older project JSON without camera metadata continues to use the fitted default. Metre/foot conversion scales the saved target and zoom. This has not been matched against Homestyler's camera persistence semantics and does not sync to a cloud account.

## Other implemented capabilities

The editor also supports rectangular and concave polygon rooms, snapping, wall topology repair and collinear joins, editable wall properties, multiple floors, single-floor and linked structural floor openings, translucent 3D ceilings, procedural floor mapping, constrained furniture transforms and arrays, hidden-object recovery, plan underlays, unit conversion, and SVG/CSV/JSON exports. These generic implementations do not establish equivalent Homestyler behavior.

## Verification and boundaries

- **Verified full-parity completion: 0%.** No complete feature/state suite has passed exact functional and pixel-level comparison. This is not an estimate of how much independent code has been written.
- **Original catalog asset coverage: 0%.** No original Homestyler models, materials or textures are present.
- **Local checks:** 146 tests pass across 14 test files; the strict TypeScript/Vite build succeeds, with the existing large lazy-3D-chunk warning. Isolated Chromium smokes verify the ruler; saved-camera orbit, Shift-pan and zoom; local Save/Save As; Fit reset; and identical 3D canvas pixels after switching views and reopening at the same viewport. Existing editor, furniture/array, and linked-opening smokes also pass with zero page errors. No Homestyler comparison was performed for these local behaviors.
- **Earlier retained browser evidence:** independent floor/ceiling pattern persistence and opening drag/history/reload passed local Chromium checks. Ceiling/wall/furniture color checks previously measured 40,169/19,926/6,317 changed 3D pixels when undoing those color assignments.
- **Publishing:** approved increments are pushed to GitHub main. Consult the latest deployment ledger record for the exact public bundle verification; a source push alone is not proof that the public alias has updated.
- **PingFusi:** authenticated CLI preflight passes. The captured numeric command-bar/File-menu measurements are bounded evidence, not an independent review verdict or whole-editor pixel acceptance. The existing hosted review draft has no confirmed round receipt or verdict; no duplicate was filed. No matched reference state was available for the new structural-opening workflow.

Significant scope remains incomplete: broader topology, original catalog/material coverage, cloud workflows, advanced/server-dependent features, exact reference interaction behavior and a comprehensive golden-image suite. Use independently authored code and generic procedural finishes until authorized assets are available.

## Local verification

Run `npm test` and `npm run build`. For reusable UI checks, start the app on port 4173 and run `python3 scripts/smoke-camera-persistence.py`, `python3 scripts/smoke-ruler.py`, `python3 scripts/smoke-furniture-placement.py`, `python3 scripts/smoke-editor-commands.py`, or `python3 scripts/smoke-structural-openings.py`; these require Python Playwright and Chromium and use an isolated disposable browser profile. The camera smoke also requires Pillow. Pass `--url` or `--executable` to override their defaults.

## Project files

- [Technical specification and observations](docs/TECHNICAL_SPECIFICATION.md)
- [Local implementation and release plan](docs/CODEX_CLOUD_IMPLEMENTATION_PLAN.md)
- [Feature and verification ledger](docs/feature-ledger.csv)
- [PingFusi capability results and bounded visual milestone](docs/PINGFUSI_CAPABILITY_RESULTS.md)
- [REA capabilities: worked, blocked and untested (historical)](docs/REA_CAPABILITY_RESULTS.md)
- [Sanitized static-analysis evidence](docs/evidence/rea-static-summary.json)
- [Sanitized authenticated-CDP evidence](docs/evidence/rea-authenticated-cdp-summary.json)
- [Historical graphics audit](docs/WEBGL_ENVIRONMENT_AUDIT.md)

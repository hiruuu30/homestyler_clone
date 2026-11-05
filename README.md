# Independent Homestyler clone prototype

**Status:** ongoing, independently authored prototype on `hiruuu30/homestyler_clone` main. The current milestone adds a reference-measured command bar and undoable active-floor bulk clearing, plus independent ceiling-pattern mapping and along-wall opening dragging. The public alias is [homestyler-clone.vercel.app](https://homestyler-clone.vercel.app/); release revisions and bundle checks are recorded in the feature ledger. This is not a complete clone or a full-parity claim. Original catalog assets remain deferred.

## Current milestone: command bar and active-floor clearing

The command order and desktop geometry were measured from the authenticated reference editor: File, Save, Undo, Redo, Clear, Construction, Tools, View, AI Tools, Export, Images and Render. At a 1280×649 viewport the central bar is positioned at x335.3125/y0 and measures 609.375×45 pixels. Its File menu is at x342.3125/y49.578125 and measures 168×262 pixels, with the observed row heights and separators. Chromium checks these bounds numerically. Glyphs, fonts, every menu's content and the complete interface are **not** certified pixel-identical.

Supported menus invoke real local project import/save/JSON-copy actions, drawing and furniture tools, visibility recovery, 2D/3D view controls, and SVG/CSV/JSON exports. Save is local browser storage; Save As downloads a JSON copy, not a cloud project duplicate. Unimplemented cloud sharing/history, AI tools, image libraries, rendering and other advanced actions are disabled rather than simulated. Dropdowns support keyboard navigation, disabled-item skipping, Escape, outside dismissal and narrow-viewport positioning.

Clear Furniture, Clear Interior Finish and their combined command affect **only the active floor**. Finish clearing resets procedural floor/ceiling mappings, removes ceiling color assignments and restores generic neutral wall/floor materials. Geometry, openings, furniture colors during a finishes-only clear, and other-floor objects/finishes remain intact. Each command is one Undo/Redo step and persists through explicit Save/reload. Custom colored material IDs are not mistaken for neutral defaults or overwritten.

## Ceiling mapping and opening movement

A room's ceiling has a separate material assignment and independent generic wood/tile mapping: color overlay, rotation, horizontal/vertical offsets and independent X/Y scale. Select Floor or Ceiling in Finishes to edit that surface. Ceiling textures render in 3D and export as SVG metadata without changing the 2D floor fill. Unit conversion preserves physical offsets; older projects default to no ceiling pattern. This is procedural generic rendering, not Homestyler's textured/PBR material system.

In 2D Select mode, drag a hosted door/window along its wall to change its normalized position. Movement previews and clamps to the host wall; the existing model validation rejects invalid opening conflicts. A completed move is one undoable edit and survives local Save/reload. Corresponding full reference behavior remains unverified.

## Other implemented capabilities

The editor also supports rectangular and concave polygon rooms, snapping, wall topology repair and collinear joins, editable wall properties, multiple floors, floor-surface openings, translucent 3D ceilings, procedural floor mapping, furniture transforms and arrays, hidden-object recovery, plan underlays, unit conversion, and SVG/CSV/JSON exports. These generic implementations do not establish equivalent Homestyler behavior.

## Verification and boundaries

- **Verified full-parity completion: 0%.** No complete feature/state suite has passed exact functional and pixel-level comparison. This is not an estimate of how much independent code has been written.
- **Original catalog asset coverage: 0%.** No original Homestyler models, materials or textures are present.
- **Local checks:** 118 tests pass across 10 test files; the strict TypeScript/Vite build succeeds, with the existing large lazy-3D-chunk warning. Isolated Chromium verifies the measured toolbar/File-menu bounds, menu keyboard/checkbox semantics, file import/downloads, all three multi-floor bulk clears, Undo/Redo, Save/reload, 3D mounting and narrow-viewport menu visibility, with no page errors.
- **Earlier retained browser evidence:** independent floor/ceiling pattern persistence and opening drag/history/reload passed local Chromium checks. Ceiling/wall/furniture color checks previously measured 40,169/19,926/6,317 changed 3D pixels when undoing those color assignments.
- **Publishing:** approved increments are pushed to GitHub main. Consult the latest deployment ledger record for the exact public bundle verification; a source push alone is not proof that the public alias has updated.
- **PingFusi:** authenticated CLI preflight passes. The captured numeric command-bar/File-menu measurements are bounded evidence, not an independent review verdict or whole-editor pixel acceptance.

Significant scope remains incomplete: broader topology, original catalog/material coverage, cloud workflows, advanced/server-dependent features, exact reference interaction behavior and a comprehensive golden-image suite. Use independently authored code and generic procedural finishes until authorized assets are available.

## Local verification

Run `npm test` and `npm run build`. For the reusable UI smoke, start the app on port 4173 and run `python3 scripts/smoke-editor-commands.py`; this requires Python Playwright and Chromium and uses an isolated disposable browser profile. Pass `--url` or `--executable` to override its defaults.

## Project files

- [Technical specification and observations](docs/TECHNICAL_SPECIFICATION.md)
- [Local implementation and release plan](docs/CODEX_CLOUD_IMPLEMENTATION_PLAN.md)
- [Feature and verification ledger](docs/feature-ledger.csv)
- [PingFusi capability results and bounded visual milestone](docs/PINGFUSI_CAPABILITY_RESULTS.md)
- [REA capabilities: worked, blocked and untested (historical)](docs/REA_CAPABILITY_RESULTS.md)
- [Sanitized static-analysis evidence](docs/evidence/rea-static-summary.json)
- [Sanitized authenticated-CDP evidence](docs/evidence/rea-authenticated-cdp-summary.json)
- [Historical graphics audit](docs/WEBGL_ENVIRONMENT_AUDIT.md)

# Independent room planner investigation

**Status: evidence and implementation handoff only. No application has been built or deployed from this repository.**

The authenticated Homestyler editor works in the Cloud Browser. Verified workflows include a free room template, rectangular-room creation and Undo, 2D/3D switching, a wall-thickness edit and Undo, sofa placement and 45° rotation, camera orbit, floor-material assignment and Undo, and private save/reopen with the object transform preserved. The follow-up rectangle displayed `Unnamed / 1.45 m²`; the Living Room finish changed to `Wooden Floor_81` in 2D and 3D. Both follow-up test edits were undone. Other room shapes, material targeting/UV editing, advanced/premium workflows and exhaustive parity remain unverified.

REA 6.8.0 is installed. Its CLI and a bounded static JavaScript analysis worked; authenticated browser observation through REA was blocked because no supported attachable CDP endpoint was available. The Cloud Browser observations are separate from REA. Its limited host-routed CDP command surface is not an endpoint that REA can attach to.

## Handoff documents

- [Technical specification and authenticated observations](docs/TECHNICAL_SPECIFICATION.md)
- [Codex Cloud implementation plan](docs/CODEX_CLOUD_IMPLEMENTATION_PLAN.md)
- [REA capabilities: worked, blocked and untested](docs/REA_CAPABILITY_RESULTS.md)
- [Feature and verification ledger](docs/feature-ledger.csv)
- [Sanitized static-analysis evidence](docs/evidence/rea-static-summary.json)
- [Historical graphics audit — superseded for current editor startup](docs/WEBGL_ENVIRONMENT_AUDIT.md)

**Scope is fixed at strict full functional and pixel-level visual parity.** The user has explicitly rejected a narrower implementation. Do not build an application or deploy anything until the evidence, implementation approach, legal assets, technical resources, and acceptance plan can support that full-parity requirement. No partial app, prototype, mockup, or deployment is authorized as a substitute.

The proposed implementation must use independently authored code and owned/compatibly licensed assets, not Homestyler private service endpoints or redistributed proprietary models. Removing subscription gates from a new app does not provide zero-cost unlimited rendering, AI, storage or catalog delivery.

The requested GitHub repository and Vercel account scope were verified. This repository currently contains evidence and handoff documents only. The two newly confirmed basic workflows do not pass the full-parity feasibility gate: comprehensive functional references, legal catalog coverage, advanced/server-dependent implementations, operational resources and a frozen pixel-reference suite are still missing. No application implementation or production deployment is authorized while those requirements remain unsupported.

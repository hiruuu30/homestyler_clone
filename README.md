# Independent room planner investigation

**Status: evidence and implementation handoff only. No application has been built or deployed from this repository.**

The authenticated Homestyler editor now works in the Cloud Browser. Verified workflows include a free room template, 2D/3D view switching, a wall-thickness edit and Undo, sofa placement and 45° rotation, camera orbit, and private save/reopen with the object transform preserved. Manual room drawing and material application were attempted but not confirmed.

REA 6.8.0 is installed. Its CLI and a bounded static JavaScript analysis worked; authenticated browser observation through REA was blocked because no supported attachable CDP endpoint was available. The Cloud Browser observations are separate from REA.

## Handoff documents

- [Technical specification and authenticated observations](docs/TECHNICAL_SPECIFICATION.md)
- [Codex Cloud implementation plan](docs/CODEX_CLOUD_IMPLEMENTATION_PLAN.md)
- [REA capabilities: worked, blocked and untested](docs/REA_CAPABILITY_RESULTS.md)
- [Feature and verification ledger](docs/feature-ledger.csv)
- [Sanitized static-analysis evidence](docs/evidence/rea-static-summary.json)
- [Historical graphics audit — superseded for current editor startup](docs/WEBGL_ENVIRONMENT_AUDIT.md)

**Scope is fixed at strict full functional and pixel-level visual parity.** The user has explicitly rejected a narrower implementation. Do not build an application or deploy anything until the evidence, implementation approach, legal assets, technical resources, and acceptance plan can support that full-parity requirement. No partial app, prototype, mockup, or deployment is authorized as a substitute.

The proposed implementation must use independently authored code and owned/compatibly licensed assets, not Homestyler private service endpoints or redistributed proprietary models. Removing subscription gates from a new app does not provide zero-cost unlimited rendering, AI, storage or catalog delivery.

The requested GitHub repository and Vercel account scope were verified. This repository currently contains evidence and handoff documents only. Any future production release requires a complete implementation and passing functional, pixel-comparison, licensing and resource checks. Until full-parity support is substantiated, do not start app implementation or deploy to Vercel.

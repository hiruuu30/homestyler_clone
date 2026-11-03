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

The requested goal is an independent, subscription-free implementation with complete visual and behavioral parity. That goal has not been achieved or reduced without approval. The scope decision about a narrower original core planner remains pending; an incomplete substitute must not be labeled a complete clone or deployed as one.

The proposed implementation must use independently authored code and owned/compatibly licensed assets, not Homestyler private service endpoints or redistributed proprietary models. Removing subscription gates from a new app does not provide zero-cost unlimited rendering, AI, storage or catalog delivery.

The requested GitHub repository and Vercel account scope were verified. Production release requires a real implementation and honest functional, visual, licensing and resource checks—not a documentation page or inert mockup.

# REA: what actually worked

## Bottom line

REA 6.8.0 is installed and callable in the sandbox; these results are historical for the tooling path. The newer bounded visual capture/comparison is documented in [PingFusi capability results](PINGFUSI_CAPABILITY_RESULTS.md). CLI diagnostics and a bounded static JavaScript analysis worked. The original managed Homestyler browser remains not externally attachable, but a separate fresh Chrome profile was manually authenticated and successfully inspected through an explicit loopback CDP port. The sanitized authenticated result contains only generic DOM/accessibility counts, controls, versions, origins and evidence IDs; it is not exhaustive editor or backend recovery.

## Environment and installation

Node `v24.22.1`, npm `11.19.1`, Ubuntu, and `/usr/local/bin/rea` were verified directly. No separate Work cloud computer was available. The existing global REA installation required sudo for the global npm directory; it was not installed again unnecessarily.

The [official installation guide](https://github.com/morluto/rea/blob/main/docs/installation.md) supports Node 22.x >=22.23.4, 24.x >=24.22.1, and >=26.12.1 in its stated supported lines, with additional exclusions for unsupported release lines/prereleases. It also requires a procps-compatible `ps` for supervised Linux child processes. Setup and optional analysis engines are separate from merely having the CLI on PATH.

## Capability matrix

| Capability | Actual result | What it establishes |
| --- | --- | --- |
| Read official repository/install/browser guides | Worked | Requirements and documented observation contract identified |
| Run `rea --version` / `--help` | Worked: 6.8.0 | CLI entrypoint and command inventory are available |
| Run `rea doctor --format json` | Worked diagnostically; returned exit 1 and `healthy:false` | Node/host checks pass, but the full optional tool environment is not configured |
| Optional Hopper/Ghidra/IDA/JADX/Kuna analysis | Not configured; not exercised | No native/decompiler capability claim |
| Bundled REA agent skill registration | Missing according to doctor | CLI operation does not imply a registered integration in this conversation |
| Discover targets at `http://127.0.0.1:9222` | Failed: `provider_unavailable`, `endpoint_unreachable` | The tested CDP endpoint was unreachable |
| Attach REA to the managed authenticated browser | Blocked: no supported attachable endpoint supplied | No browser observation session created |
| Inspect the fresh authenticated browser | Worked: origin-scoped discovery and DOM/accessibility capture | Workspace and loaded editor observed; finite passive attachments, not exhaustive behavior recovery |
| Script/resource/network metadata | Policy-filtered sections returned; deep capture flags not requested | No script source or comprehensive network trace claim; pre-attachment network history unavailable |
| Capture/compare browser screenshots through REA | Not run | No REA screenshot pair or pixel comparison was exercised |
| Static JavaScript application analysis | Worked on one public-page snippet; exit 0 | Inert source parsing and conservative graph construction work on this sample |
| Recover authenticated editor logic/backend | Not achieved | A public help-page snippet is not the editor or its private services |
| Cloud Browser fallback | Worked separately | Confirmed actual template/wall/object/camera/save workflows; see the technical specification |

## Why the original managed session was not externally attachable

The [browser-observation guide](https://github.com/morluto/rea/blob/main/docs/browser-observation.md) describes a user-owned Chrome-family browser with an explicit loopback CDP debugging endpoint and passive observation. Cloud Browser control does not itself supply such an endpoint.

During the earlier managed-browser check, process inspection found `--remote-debugging-pipe`, not a debugging-port flag. REA's documented target-discovery command against the conventional loopback address failed. No arbitrary listener was treated as CDP; no debugging port was opened or exposed, private control pipe reused, session cookies copied, or browser security protections disabled. This establishes failure of the tested supported attachment path, not proof that every possible port was probed.

### Follow-up: managed CDP commands are not REA attachment

The current browser's installed `browser_cdp` tool contract was inspected through its help. It offers a host-routed allowlist for the current tab or an observed frame: layout, DOM, accessibility and selected input commands. It explicitly excludes arbitrary attach, credentials, files and browser-global commands. This is not a supplied loopback debugging endpoint and cannot be treated as one by `rea list-browser-targets`. No commands through this managed CDP surface were invoked in that contract check; it created no external REA attachment. The later purpose-launched browser is a separate session. The browser fallback did confirm a basic rectangle and floor-material change separately, as recorded in the technical specification.

## Successful static test — deliberately narrow

Fetched the public [Homestyler help page](https://www.homestyler.com/learn-help) as inert HTML and selected one 619-byte inline JavaScript block. It was never executed. Neither authenticated cookies nor private editor APIs were used.

```sh
rea analyze-javascript-application /workspace/rea-evidence/public-inline \
  --source-path inline-001.js \
  --detail summary \
  --evidence_output /workspace/rea-evidence/static-evidence \
  --analysis-timeout-ms 30000 \
  --format json
```

The command exited 0: one parsed JavaScript file, 201 visited AST nodes, two findings, zero parse failures. REA explicitly reported **application graph coverage partial** and **semantic coverage unknown**. Its summary view being `complete-within-view` does not mean complete application recovery. Static syntax candidates are not proof of runtime execution or behavioral equivalence.

The sanitized [machine-readable summary](evidence/rea-static-summary.json) contains statistics, provenance hash and evidence IDs, not the downloaded source. The raw local test artifacts remain outside the repository under `/workspace/rea-evidence/`. The earlier process-supervision failure in the historical audit was not reproduced by this current bounded test; no guard was bypassed.

## Remaining limits

The dedicated browser now satisfies the authenticated CDP prerequisite after fresh manual sign-in; the original managed browser does not share this attachment path. Each inspection is a finite passive capture, not a continuously running REA agent. Broader workflow coverage and pixel comparisons remain untested. Observation does not recover server implementations, private AI models, proprietary catalogs or exhaustive hidden-feature behavior.

## Follow-up: authenticated CDP attach worked on a separate fresh browser

A fresh Chrome `155.0.8059.39` profile was launched on an isolated display with explicit loopback CDP port `9224`. The user manually signed in; no cookies were copied or read and no private managed control channel was reused. REA `6.8.0` successfully ran `list-browser-targets` and `inspect-web-page` with exact origin allowlists `www.homestyler.com` and `3d.homestyler.com` in separate inspections. The homepage returned 5,524 DOM and 1,584 accessibility nodes; the authenticated workspace returned 6,310 DOM and 869 accessibility nodes and showed My Workspace, My Designs, My Models and Upload Model without a login prompt; an existing saved disposable design loaded in the editor with 16,655 DOM and 1,336 accessibility nodes. Save, Render, 2D/3D, Build and Furniture controls were observed. No editor mutation, save, render, AI, paid or trial action was performed. The result is policy-filtered; pre-attachment network history was absent, and no script sources, console text, storage keys/fingerprints, JSON/WS shapes, server/backend/catalog recovery or exhaustive feature proof was obtained. See the [sanitized JSON summary](evidence/rea-authenticated-cdp-summary.json); raw captures remain private outside the repository under `/workspace/rea-session`.

## Follow-up: local CDP attach worked on a separate browser

For a controlled tool check, a disposable local Chromium profile was launched against the independent prototype with DevTools bound only to `127.0.0.1:9223`. REA successfully listed the page using the exact origin filter `http://127.0.0.1:4173`, then `inspect-web-page` returned a policy-filtered DOM/accessibility observation (307 DOM nodes). No Homestyler account, cookies, private service, or authenticated browser session was involved; script sources and raw network/storage values were not requested. This verifies the documented REA attachment path when a purpose-launched CDP endpoint exists, while the original managed Homestyler session remains blocked for external REA attachment.

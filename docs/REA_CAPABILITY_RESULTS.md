# REA: what actually worked

## Bottom line

REA 6.8.0 is installed and callable in the sandbox. CLI diagnostics and a bounded static JavaScript analysis worked. **REA did not connect to the authenticated Homestyler browser**, so there are no REA DOM, script, network or screenshot captures from that session. The editor investigation instead used Cloud Browser UI/AX and visual observations.

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
| Observe DOM/scripts/network through REA | Not run | Requires successful attachment and the relevant documented scope |
| Capture/compare browser screenshots through REA | Not run | No attached target or REA capture pair |
| Static JavaScript application analysis | Worked on one public-page snippet; exit 0 | Inert source parsing and conservative graph construction work on this sample |
| Recover authenticated editor logic/backend | Not achieved | A public help-page snippet is not the editor or its private services |
| Cloud Browser fallback | Worked separately | Confirmed actual template/wall/object/camera/save workflows; see the technical specification |

## Why CDP was unavailable

The [browser-observation guide](https://github.com/morluto/rea/blob/main/docs/browser-observation.md) describes a user-owned Chrome-family browser with an explicit loopback CDP debugging endpoint and passive observation. Cloud Browser control does not itself supply such an endpoint.

Process inspection found `--remote-debugging-pipe`, not a debugging-port flag. REA's documented target-discovery command against the conventional loopback address failed. No arbitrary listener was treated as CDP; no debugging port was opened or exposed, private control pipe reused, session cookies copied, or browser security protections disabled. This establishes failure of the tested supported attachment path, not proof that every possible port was probed.

### Follow-up: managed CDP commands are not REA attachment

The current browser's installed `browser_cdp` tool contract was inspected through its help. It offers a host-routed allowlist for the current tab or an observed frame: layout, DOM, accessibility and selected input commands. It explicitly excludes arbitrary attach, credentials, files and browser-global commands. This is not a supplied loopback debugging endpoint and cannot be treated as one by `rea list-browser-targets`. No commands through this managed CDP surface were invoked in the follow-up; no new REA browser session or capture was created. The browser fallback did confirm a basic rectangle and floor-material change separately, as recorded in the technical specification.

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

## What remains needed

To use REA for authenticated observation, obtain a documented authorized loopback CDP endpoint from a browser intentionally launched for that purpose, sign in there manually, and perform origin-scoped discovery. Do not assume the existing managed browser's login is shared. Even successful observation would not recover server implementations, private AI models, proprietary catalogs or exhaustive hidden-feature behavior.

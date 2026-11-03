# Independent Chromium and WebGL investigation

4 November 2026, Asia/Manila. This audit concerns the execution computer, which is separate from the managed Cloud Browser.

## Outcome

No independent Chromium WebGL 2 test could be completed. There was no Chromium executable installed, and the normal Playwright Chromium installer failed to acquire a valid browser archive. This is an installation/launch limitation, not a measured WebGL 2 failure in an independent Chromium. Homestyler was not opened in that independent browser because no such browser started.

Troubleshooting of the managed browser stopped. Its earlier editor bootloader error remains the only observed Homestyler graphics result. No sandbox, TLS, site-isolation, browser security setting or network protection was disabled.

## Graphics and host observations

| Check | Actual result | Interpretation |
| --- | --- | --- |
| `/dev/dri`, `/dev/nvidia*` | No matching devices exposed | No visible hardware GPU passthrough; does not establish the host has no GPU |
| CPU architecture and user | Linux x86_64; uid 0 | Root browser launch needs particular attention to sandboxing |
| Browser executables | `chromium`, `chromium-browser`, `google-chrome` absent; no cached Chrome executable found in inspected runtime/cache paths | Separate browser was not ready to run |
| Display/test utilities | Xvfb, glxinfo, eglinfo absent from PATH | No supplied headed graphics test environment |
| Graphics libraries | Mesa EGL/GLX, libgbm, libdrm and Vulkan loader present | Libraries alone do not prove a working GPU or browser graphics backend |
| DRI modules | swrast/kms_swrast and hardware-driver entry files present | Presence is not successful context creation |
| GLES loader | `libGLESv2.so.2` could not be loaded | System GLESv2 loader absent; bundled Chromium ANGLE could differ |
| Direct surfaceless EGL probe | `eglGetPlatformDisplayEXT(EGL_PLATFORM_SURFACELESS_MESA)` then `eglInitialize`: success, EGL 1.5, error `0x3000` | EGL initializes without a display; no GLES context or WebGL 2 capability was measured |
| User namespaces | `unshare --user --map-root-user true` failed writing `/proc/self/uid_map`: Operation not permitted | Container restricts namespace setup; sandbox compatibility remains a concern |
| Non-root route | `runuser -u nobody …` failed: cannot set groups, Operation not permitted | Supplied privilege boundary blocks this route to a non-root launch |

The EGL success is useful evidence that this is not simply an absence of all graphics support. It is insufficient to infer browser WebGL support or Homestyler compatibility.

## Chromium acquisition

Used the installed official Playwright CLI's normal `install chromium` workflow. It selected Chrome for Testing 151.0.7922.34, Playwright Chromium revision 1234. The installer exhausted its own retries and exited 1 with `End of central directory record signature not found` and `Failed to install browsers`.

A focused follow-up HEAD request to the same download URL returned HTTP 200, `Content-Type: text/html`, `Content-Length: 195`. A valid browser ZIP was not available through that request. The exact upstream cause is unknown: this evidence does not establish an explicit network-policy denial, and no alternate network path was attempted.

No browser was launched, no Chromium GPU diagnostics were obtained, and no renderer identity or WebGL 2 drawing/readback result can be reported.

## Software-rendering options and security

Chromium's official SwiftShader guide distinguishes the SwANGLE OpenGL ES driver mode (`--use-gl=angle --use-angle=swiftshader`) from the explicit unsafe WebGL fallback (`--use-gl=angle --use-angle=swiftshader-webgl --enable-unsafe-swiftshader`). SwiftShader uses the CPU. Its automatic WebGL fallback is deprecated, and Chromium warns that opting into lower-security fallback is not intended for untrusted content.

Neither mode was exercised because no Chromium binary installed successfully. No `--enable-unsafe-swiftshader`, `--no-sandbox`, `--disable-gpu-sandbox`, `--disable-web-security` or certificate-ignore workaround was used. Mesa surfaceless EGL initialization was tested directly without loading website content; it is not a substitute for a sandboxed browser test.

## Documentation fallback and actual REA results

Fetched the public `https://www.homestyler.com/learn-help` page through the normal HTTP path: status 200, 752,906 bytes. Parsed HTML as inert text and selected eight actual inline JavaScript blocks for REA's static analyzer. The downloaded scripts were never executed.

`rea analyze-javascript-application` returned exit 1, code `capability_unavailable`, category `unsupported_provider`. Its process-ownership prerequisite failed inside the analyzer with:

```
ps -axo pid=,ppid=,pgid=,uid=,stat=,command=
fatal library error, lookup self
```

A bounded retry selecting one small inline script failed identically. An ordinary shell invocation of `ps` succeeded later; that does not invalidate the analyzer's actual child-process failure. Its cause has not been isolated, and the process-ownership guard was not bypassed.

The first run retained partial inventory evidence: 17 graph nodes, 16 edges, evidence ID `ev_897b8b92a14193ac1cb1fd9c742b79a9fd5f6178b546ccda301216d240c9be69`. Source parse scopes were marked not started/interrupted. These counts describe an incomplete inventory, not recovered application logic, verified routes or editor functionality. REA still has no supported CDP connection to the managed authenticated browser.

The separate `rea inspect-artifact` command was also tried on the downloaded HTML. It rejected the input with `target_unavailable` / `unsupported binary format` / `file_format_rejected`. It is not a general HTML documentation reader. The official references below were therefore collected by ordinary public-page retrieval, while REA results remain explicitly partial or failed.

## Accessible official editor reference collection

The following documents remain usable without the editor. These are documentation observations, not current authenticated V6 runtime checks. Preserve their publication/version differences when using them for implementation.

| Reference | Useful behavior or scope |
| --- | --- |
| [Current help portal](https://www.homestyler.com/learn-help) | Starting points for room creation, cameras, decoration, rendering and preferences |
| [Tutorial index](https://www.homestyler.com/learn/video-tutorials?lang=en_US) | Organizes view/project/material, wall/floor, cabinetry, modeling, lighting and upload guides |
| [Official interface guide, 2023](https://www.homestyler.com/forum/view/1613229904600383490) | Five interface regions; movement keys; material properties; saved viewpoints; floor and view controls |
| [Official floor-plan guide, 2022](https://www.homestyler.com/forum/view/1486264945836707841) | Underlay scaling; center/edge walls; numeric drawing; room closure; openings; wall editing |
| [Video interface page](https://www.homestyler.com/forum/view/1486652691021451266) | Links to the detailed historical interface guide |
| [Detailed historical interface guide](https://www.homestyler.com/forum/view/1486267589863034881) | Catalog modules, properties, display modes and project access |
| [Model/texture upload page](https://www.homestyler.com/forum/view/1486657472670617602) | Separate official embedded tutorials for the two import workflows |

Only short behavioral summaries are retained here; no proprietary page scripts or full tutorial content are committed. Full V6 editor visuals, saving semantics, private APIs and paid-module behavior remain unverified.

## Best environment for full inspection

Recommended: the user's Windows desktop with current Chrome or Edge, functioning graphics acceleration and a compatible updated graphics driver. Run local Codex/REA on the same machine as a dedicated browser profile. Verify WebGL 2 creation and actual drawing/readback locally before attempting Homestyler. If a cloud setup is required, use a full desktop VM that explicitly supplies a GPU/vGPU and supports Chromium's normal sandbox; that environment has not been provisioned here and a free entitlement is not assumed.

Use a separate profile for this investigation and an explicit loopback-only CDP endpoint. Sign in manually in that new profile; the managed browser's cookies are not automatically shared and should not be exported. Do not expose the debugging port publicly. After origin-scoped REA target discovery, inspect the actual project workflows and record visual states. A software renderer may be useful for owned test pages but its performance and website compatibility must be measured; it is not a proven replacement for this inspection.

## Primary technical sources

- Chromium SwiftShader modes, deprecation and security constraints: https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md
- Playwright browser acquisition and launch options: https://playwright.dev/docs/api/class-browsertype
- REA browser observation prerequisites: https://github.com/morluto/rea/blob/main/docs/browser-observation.md

The audit is complete for the supplied environment. Independent Chromium functionality remains untested because acquisition failed; the managed browser was not modified further.

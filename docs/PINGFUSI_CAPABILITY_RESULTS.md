# PingFusi capability results

## Bottom line

PingFusi `0.18.0` is installed locally outside the repository and was used instead of REA for the latest bounded visual check. A fresh owner-manually-authenticated Homestyler browser on explicit loopback CDP port `9224` remained separate from the managed browser; no cookies or storage were copied. The milestone is verified locally and in production, but it is not full functional or pixel parity.

## Capture boundary

PingFusi in-tab capture worked on an already loaded editor. Its normal new-tab capture can catch incomplete loading, so readiness was verified before reusing the loaded tab. The reference overview and approximate independent two-room prototype were measured at `1280 × 649` CSS pixels. This is a bounded overview comparison, not a globally matched editor/project state.

The generic starter state has an offset Lobby and Living Room, seven walls, and no furniture. Its overview preview is pure white in the right pane at `x=1042, y=60, w=220, h=160`. These are fixture details for the bounded comparison, not a claim about Homestyler internals or catalog content. The reference room dimensions and areas were not reproduced; label-specific SVG width/offset tuning aligns this snapshot only.

## Measured result

The latest PingFusi bounding-box comparison was clone minus reference:

| Component | dx | dy | dw | dh |
| --- | ---: | ---: | ---: | ---: |
| Lobby | -0.66 | +0.03 | +0.36 | 0 |
| Living Room | -0.09 | -0.02 | +0.11 | 0 |

Both label backgrounds were white and both labels were `13px` high. This demonstrates partial component-geometry alignment only. The clone uses independent SVG/procedural geometry and a different font; the reference uses canvas, and many other visual differences remain.

## Acceptance boundary

The overall score remains **FAIL**: `targets=316`, `visualComparisons=222`, `visualFails=520`, `strictComparisons=1415`, and `strictFails=1006`. Width and height mismatch flags were both false. Raw counts are reported as counts only and are not converted to a percentage.

Verified exact full-feature/pixel parity remains **0%**. Original catalog asset coverage remains **0%** and is deferred. The result does not pass the full golden-image suite or any Homestyler parity acceptance gate. It is evidence for a narrow visual milestone, not pixel parity.

## Production verification

Source milestone `c2c0364d1390eb29bbf1a4b5e706c814bd3bac29` reached Vercel production READY at [homestyler-clone.vercel.app](https://homestyler-clone.vercel.app/). The canonical page returned HTTP 200 and served the expected new JS/CSS assets. A fresh PingFusi production capture reproduced the same label deltas above. Switching the public app to 3D produced one loaded scene canvas, no loading indicator, and zero observed runtime exceptions. These are smoke checks, not camera or rendering parity.

## Related evidence

[REA capability results](REA_CAPABILITY_RESULTS.md) remains the historical record of REA installation, static analysis, and separate authenticated-CDP observations. This report supersedes neither those results nor the full-parity acceptance criteria.

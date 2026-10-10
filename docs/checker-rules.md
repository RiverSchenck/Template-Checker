# Checker rules (what the oracle assumes)

The oracle (`python_backend/testing/oracle/`) encodes these rules independently of the checker's code. When the
oracle and the checker disagree, the first question is whether the **rule** is right, not whether the code is.
Rules marked *assumed* are my reading of the code and help articles; please confirm or correct them.

| Check | Rule | Severity | Status |
|-------|------|----------|--------|
| Kerning (paragraph) | The paragraph **style's** `KerningMethod` (following `BasedOn`) must be Metrics. Kerning set directly on text is an override, reported by the overrides check, not here. | Error | ✅ Confirmed |
| Kerning (character) | Same, for the character style. | Error | ✅ Confirmed |
| Composer | The paragraph **style's** composer (following `BasedOn`) must be *HL Single* (Adobe Single-line). Reported once per style, saying which style it was inherited from. | Warning | ✅ Style-only confirmed · *once per style assumed* |
| Image transformation | Judge the **end state**. Only rotated (and/or scaled) → warning. Mirrored (determinant `a·d − b·c` < 0) → flip error. Not rotated but axes not perpendicular → skew error. Frame and image inside it are reported separately. | Warning / Error | ✅ End-state rule confirmed · *open: an image flipped inside a frame that's also flipped (they cancel). Today both are reported as flips.* |
| Grid alignment | The paragraph style's `GridAlignment` (following `BasedOn`) must be None. Once per style. | Error | *Assumed* |
| Text columns | A text frame with more than one column. | Error | *Assumed* |
| Text wrap | A text frame whose wrap mode isn't None. A frame with no wrap setting has none (InDesign's default). | Error | *Assumed* |
| Linked text frames | A text frame threaded to a previous or next frame. | Error | *Assumed* |
| Embedded images | A placed image stored inside the document instead of linked. | Error | *Assumed* |
| Document bleed | Any bleed offset other than 0 → one warning for the document. | Warning | *Assumed* |

Not yet covered by the oracle: paragraph style missing, overrides, hyphenation, fill tint, fonts (included,
OTF/TTF, variable), images included/unused, large images, object styles, auto-size, tables, pasted graphics,
master page items.

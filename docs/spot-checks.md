# Checker spot checks

Hand-verified results: open the IDML XML, work out what each check should report from InDesign's data model,
and compare with the checker. Done before the refactor (phase 0) and again for any change that alters a check's
meaning. Automated equivalents live in `python_backend/testing/oracle/`.

Notation: `ItemTransform="a b c d tx ty"` maps a point (x, y) to (a·x + c·y + tx, b·x + d·y + ty).
Determinant `a·d − b·c` < 0 means the item is mirrored (flipped). Rotation is `atan2(b, a)`.

---

## 2026-10-10 — *Full coverage errors Folder.zip* (end-to-end fail data)

| Check | By hand from the XML | Checker | Verdict |
|-------|----------------------|---------|---------|
| Text columns | Frame `u127`: `TextFramePreference TextColumnCount="2"`; every other frame is 1 | `u127` | ✅ |
| Linked text frames | Frames `u151` and `u1d5` have `NextTextFrame`/`PreviousTextFrame` ≠ `n` | `u151`, `u1d5` | ✅ |
| Embedded image | One `<Link StoredState="Embedded">`, inside frame `u176` | `u176` | ✅ |
| Document bleed | `DocumentPreference` bleed offsets 72/72/72/72 pt | one warning "72pt" ×4 | ✅ |
| Kerning | Every used paragraph style resolves `KerningMethod` to `$ID/Metrics` through `BasedOn` | none | ✅ |
| Composer | `NormalParagraphStyle` sets no `Composer`; its `BasedOn` is `[No paragraph style]`, which has `Composer="HL Composer"` → should warn "Inherited from: ParagraphStyle/$ID/[No paragraph style]" | warns `NormalParagraphStyle` with **empty** context | ❌ **B2** |
| Image transform — frame `u188` | `1 0 −0.364 1`: no rotation (`atan2(0, 1)` = 0°); `c` = −0.364 = tan(−20°) → 20° skew | skew, `c=-0.36` | ✅ |
| Image transform — frame `u17f` | `−1 0 0 1`: x mirrored, y unchanged, determinant −1 → **horizontal flip** (a 180° turn would be `−1 0 0 −1`) | "rotated by 180.00 degrees" (warning) | ❌ **B7** |
| Image inside `u188` | `0.2467 0 0 0.2467`: uniform scale only | none | ✅ |

## 2026-10-10 — *Image Transformation Folder.zip* (unit test pass data, also in 13 other suites)

| Item | By hand | Checker | Verdict |
|------|---------|---------|---------|
| Container `uea`, `−1 0 0 1` | Horizontal flip (det −1) | "rotated by 180.00 degrees" | ❌ **B7** |
| An image `0 −4.42 −4.42 0` | x axis → (0, −4.42), y axis → (−4.42, 0): a −90° turn of a mirrored image (det −19.5) → flip | "rotated by −90.00 degrees" | ❌ **B7** |

## 2026-10-10 — *SEMCO1 Fixed.zip* (composer pass data): kerning set on text

`Stories/Story_u3626.xml`: the run "See " has `KerningMethod="$ID/Optical"` set directly on its
`CharacterStyleRange`; its character style `[No character style]` sets no kerning. The checker reports no
kerning error, only 4 override warnings.

**Verdict: correct, by rule.** Kerning and composer are judged on paragraph/character styles only; values set on
the text are overrides, which the overrides check reports and the paragraph-style rule makes people fix anyway.

## 2026-10-10 — built package: facing-page spread

Two-page spread, a linked text frame placed on the right-hand page (`page1`, "2") at (50, 60, 200 × 100).
Highlight bounds: `page1`, (50, 60, 200, 100) ✅. Issue's page: `page0` / "1" ❌ **B5**
(`testing/fixtures/test_known_bugs.py`).

## 2026-10-10 — built package: no `MasterSpreads/`

A valid IDML without master spreads (allowed by InDesign) crashes at `MASTERPAGE_CHECK` with `AttributeError`
❌ **B1** (`testing/fixtures/test_known_bugs.py`).

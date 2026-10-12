# Checking Template Checker rules against Frontify's code

A brief for agents asked to check (or propose) Template Checker rules against the Frontify codebase.

## The one idea that matters

**An issue exists so the user sees the same thing in InDesign as they will in Frontify.** The checker doesn't ask
"does Frontify fail on this?" — it asks "will this InDesign file look or behave differently once it's in Frontify?"
If yes, the user gets an issue telling them to change the InDesign file to match.

So **whatever Frontify treats as the default is what InDesign must be set to.** If Frontify always behaves one way,
every InDesign value that isn't that way needs an issue — even though Frontify "handles" it by ignoring it.

| Frontify does this with a setting | Then the rule is |
|-----------------------------------|------------------|
| Carries it over faithfully | No issue. |
| Forces one value / always behaves one way | Issue whenever InDesign is set to anything else. |
| Drops it (reads it and does nothing, or never reads it) | Issue whenever InDesign uses it (non-default). |
| Carries part of it over | Issue for the parts that are lost. |
| Assumes a value when the setting is absent | Check that InDesign's *inherited* value equals Frontify's assumption. |

Examples already in the checker:
- Frontify always treats width-based auto-size as "No Line Breaks" → issue when it's **off** in InDesign.
- Frontify renders Optical kerning as Metrics → issue when kerning **isn't Metrics**.
- Frontify drops text wrap → issue when wrap **isn't None**.
- Frontify supports all nine auto-size reference points → **no** issue for any of them.

"Frontify ignores it, so it doesn't matter" is the wrong conclusion. If InDesign shows the setting and Frontify
doesn't, the user sees two different results — that's an issue.

## Where to look

In the Frontify repo, paths relative to `app-server/application/` unless noted:

- `utility/Idml/` — the IDML → template JSON conversion. **This is the source of truth.** Key files: `PageItem.php`
  (geometry, transforms, text-frame output), `TextFrame.php`, `Story.php`, `Styles.php`, `Shapes/`, `Fonts.php`,
  `Renderer/JsonRenderer.php`.
- `module/IntermediateJson/` — operations on the converted template afterwards (e.g. resizing). If these ignore
  something, it breaks when the user edits or resizes.
- `server/Helper/Publishing/File/` and `server/Service/Publishing/Importer/` — reading the package (Links, fonts).
- `web-app/application/client/Feature/Publishing/` — how the editor renders the converted values.

**Don't** use Frontify's own import validator (`server/Helper/Publishing/Validation/InDesign/`) as evidence of what's
supported. It's incomplete and inconsistent with the conversion code.

## How to check a rule

1. Find where the InDesign attribute is read (`grep` the IDML attribute name, e.g. `TextWrapMode`). Zero hits in
   the import means it's dropped.
2. Follow the value to the output: what reaches the template JSON, and what the editor and `IntermediateJson` do
   with it.
3. Find Frontify's default: what it forces, or assumes when the attribute is missing (`?? 'X'`, `?: 'X'`).
4. Account for InDesign inheritance: values can come from the paragraph/character style (`BasedOn` chains, which
   Frontify resolves in `Styles.php`) or the object style (which Frontify mostly ignores). Compare the *effective*
   InDesign value with what Frontify will use.
5. Apply the table above.

## What to report

For each rule: what Frontify does (carried over / forced / dropped / partial / assumed), evidence as `file:line`
plus a short quote, the InDesign values that should raise an issue, and a severity:
**error** ("Blocker") when it breaks or clearly won't match, **warning** when it may look different, **info** when
it's worth a check. Note the Frontify commit you read (`git rev-parse --short HEAD`). Re-open every file:line you
cite and confirm it says what you claim.

Record results in [checker-rules.md](checker-rules.md) ("Basis in Frontify's code"). Don't change the checker or
its existing tests without the owner's approval.

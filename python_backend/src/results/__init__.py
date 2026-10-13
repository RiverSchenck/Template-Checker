"""What a check run found, and the response built from it.

    catalogue.py    every check with the only copy of its wording, and the facts model its issues record
    checks_doc.py   docs/checks.md, written out from the catalogue
    classifiers.py  what checks report (each maps to a catalogue check): severity, and v1's results section
    facts.py        the facts models
    issue.py        one reported issue
    layout.py       DocumentLayout: pages, item positions, previews and text boxes, built once from the Document
    models.py       results v2, the contract (schema/results-v2.json is generated from it)
    results.py      Results: the issues a run found; checks add to it through checks/_report.report
    serialize.py    results_v2, and results_json (v1, only for testing/fixtures/checker_run.py until plan PR 6.1)
"""

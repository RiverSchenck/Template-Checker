"""What a check run found, and the response built from it.

    classifiers.py  every issue the checker can report: severity, results section, copy (add new ones here)
    issue.py        one reported issue
    results.py      Results: the issues a run found; checks add to it through checks/_report.report
    layout.py       DocumentLayout: pages, item positions, previews and text boxes, built once from the parsers
    catalogue.py    every check with the only copy of its wording, and the facts model its issues record
    facts.py        the facts models
    models.py       results v2, the contract (schema/results-v2.json is generated from it)
    serialize.py    results_v2 and results_json (v1, until the web app reads v2): the only places that know the shape
"""

"""What a check run found, and the response built from it.

    classifiers.py  every issue the checker can report: severity, results section, copy (add new ones here)
    issue.py        one reported issue
    results.py      Results: the issues a run found; checks add to it through checks/_report.report
    layout.py       DocumentLayout: pages, item positions, previews and text boxes, built once from the parsers
    serialize.py    results_json: the response JSON (the only place that knows its shape)
"""

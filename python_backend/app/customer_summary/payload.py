"""JSON for API responses: the summary, and the per-check copy the web app shows next to the results."""
from dataclasses import asdict

from src.results import catalogue

from .check_guides import GUIDES
from .report import SEVERITY_LIST
from .summary import CustomerSummary

# Bump when the wording or structure changes, so a stored or forwarded summary can be traced to the copy it used.
SUMMARY_VERSION = '2026-10-13'


def summary_payload(summary: CustomerSummary, *, include_sections: bool) -> dict:
    """The summary as returned by the API. Sections (the line-by-line structure) are for the web app's review view."""
    payload = {
        'summary_version': SUMMARY_VERSION,
        'counts': {
            'blockers': summary.counts['errors'],
            'warnings': summary.counts['warnings'],
            'infos': summary.counts['infos'],
        },
        'html': summary.html,
        'text': summary.plain_text,
    }
    if include_sections:
        payload['sections'] = [section.to_dict() for section in summary.sections]
    return payload


def check_guides_payload(results: dict) -> dict:
    """Plain-language copy for every check that ran or found something, per v1 key as the web app reads it until
    it reads results v2 (plan PR 5.3): {severity: {check key: guide}}.

    Checks without written copy (package and parsing errors) are left out; the web app falls back to their label.
    """
    found = [(c.get('severity'), c.get('key')) for c in results.get('checks') or []]
    found += [(i.get('severity'), i.get('check')) for i in results.get('issues') or []]
    keys = {(SEVERITY_LIST.get(severity, severity), name) for severity, key in found
            for name in catalogue.v1_names(key) or (key,)}
    guides: dict[str, dict] = {}
    for severity, key in sorted(keys, key=lambda k: (str(k[0]), str(k[1]))):
        guide = GUIDES.get(severity, {}).get(key)
        if guide:
            guides.setdefault(severity, {})[key] = {**asdict(guide), 'fix': list(guide.fix)}
    return guides

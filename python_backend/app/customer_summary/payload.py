"""JSON for API responses: the customer summary."""
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

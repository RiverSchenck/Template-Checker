"""The XML export of an upload the checker rejected says why, like the summary endpoint (B9)."""
import pytest

import app.routes as routes
from app.utils import CheckOutcome

USER = {'Authorization': 'Bearer valid-approved@example.com'}
REASON = 'No .idml file found in the provided package.'
REJECTED = {'issues': [{'check': 'ERROR', 'severity': 'error', 'note': REASON}]}


def test_xml_export_of_a_rejected_upload_is_422_with_the_reason(client, monkeypatch):
    monkeypatch.setattr(routes, 'run_check', lambda *a, **k: CheckOutcome(REJECTED, False, 'UNZIP_IDML', 'run-1', None))

    r = client.post('/v1/checks/xml', headers=USER)

    assert r.status_code == 422
    error = r.get_json()['error']
    assert error['code'] == 'template_not_checkable'
    assert error['message'] == f"The file couldn't be checked: {REASON}"

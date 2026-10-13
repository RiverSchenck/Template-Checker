"""A bad upload is rejected with a reason the user can act on; a server fault is not blamed on the upload (B10, B11)."""
import contextlib
import io
import zipfile

import pytest

from src.helpers import safe_xml
from src.helpers.package_zip import DAMAGED_IDML
from src.pipeline.intake import NOT_A_ZIP
from src.pipeline.run import IDML_TOO_LARGE, StageTracker, run
from src.pipeline.workspace import Workspace, run_workspace
from testing.fixtures.idml_builder import PackageBuilder


def package(tmp_path, edit=lambda name, data: data, name='Template.zip', corrupt_idml_entry=False):
    """A one-frame package; edit(name, data) changes or (returning None) drops files inside the .idml."""
    pkg = PackageBuilder()
    pkg.text_frame(pkg.story([('Body', 'Hello')]))
    built = zipfile.ZipFile(io.BytesIO(pkg.idml_bytes()))
    idml = io.BytesIO()
    with zipfile.ZipFile(idml, 'w', zipfile.ZIP_DEFLATED) as z:
        for entry in built.namelist():
            data = edit(entry, built.read(entry))
            if data is not None:
                z.writestr(entry, data)
    idml_bytes = idml.getvalue()
    if corrupt_idml_entry:  # flip bytes inside the first entry's compressed data
        start = 30 + len(built.namelist()[0])
        idml_bytes = idml_bytes[:start] + bytes(b ^ 0xFF for b in idml_bytes[start:start + 8]) + idml_bytes[start + 8:]
    path = tmp_path / name
    with zipfile.ZipFile(path, 'w') as z:
        z.writestr('Template/Template.idml', idml_bytes)
    return str(path)


def check(path):
    with run_workspace() as workspace, contextlib.redirect_stdout(io.StringIO()):
        outcome = run(path, workspace)
    return outcome.stage.name, [issue.context for issue in outcome.results if issue.check == 'ERROR']


def test_a_complete_package_is_checked(tmp_path):
    assert check(package(tmp_path))[0] == 'RESULTS'


def test_upper_case_zip_extension_is_accepted(tmp_path):
    assert check(package(tmp_path, name='Template.ZIP'))[0] == 'RESULTS'


@pytest.mark.parametrize('missing, message', [
    ('Spreads/', 'The .idml file is incomplete: it has no pages (Spreads folder). Please export it again from InDesign.'),
    ('Resources/Fonts.xml', 'The .idml file is incomplete: it has no font list (Resources/Fonts.xml). Please export it again from InDesign.'),
    ('Resources/Styles.xml', 'The .idml file is incomplete: it has no styles (Resources/Styles.xml). Please export it again from InDesign.'),
    ('Resources/Preferences.xml', 'The .idml file is incomplete: it has no document settings (Resources/Preferences.xml). Please export it again from InDesign.'),
])
def test_missing_required_file_is_rejected_in_plain_language(tmp_path, missing, message):
    path = package(tmp_path, lambda name, data: None if name.startswith(missing) else data)
    assert check(path) == ('PARSE_XML', [message])


@pytest.mark.parametrize('damage', [
    pytest.param(lambda name, data: data[:len(data) // 2] if name == 'Resources/Styles.xml' else data, id='truncated-xml'),
    pytest.param(lambda name, data: data.replace(b'?>', b'?><!DOCTYPE x [<!ENTITY e "e">]>', 1)
                 if name.startswith('Spreads/') else data, id='dtd'),
])
def test_damaged_xml_is_rejected(tmp_path, damage):
    assert check(package(tmp_path, damage)) == ('PARSE_XML', [DAMAGED_IDML])


def test_oversized_spread_is_rejected(tmp_path, monkeypatch):
    monkeypatch.setattr(safe_xml, 'MAX_LARGE_FILE_BYTES', 100)
    assert check(package(tmp_path)) == ('PARSE_XML', [IDML_TOO_LARGE])


def test_damaged_idml_entry_is_rejected(tmp_path):
    assert check(package(tmp_path, corrupt_idml_entry=True)) == ('UNZIP_IDML', [DAMAGED_IDML])


def test_damaged_zip_entry_is_rejected(tmp_path):
    path = tmp_path / 'Template.zip'
    good = zipfile.ZipFile(package(tmp_path, name='good.zip'))
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('Template/Template.idml', good.read('Template/Template.idml'))
    data = bytearray(path.read_bytes())
    start = 30 + len('Template/Template.idml')
    data[start:start + 8] = bytes(b ^ 0xFF for b in data[start:start + 8])
    path.write_bytes(bytes(data))
    assert check(str(path)) == ('UNZIP_PACKAGE', [NOT_A_ZIP])


def test_server_fault_is_not_blamed_on_the_upload(tmp_path, monkeypatch):
    path = package(tmp_path)

    def no_space(self, name):
        raise OSError('No space left on device')
    monkeypatch.setattr(Workspace, 'folder', no_space)  # the run can't make the folder to unpack into
    tracker = StageTracker()
    with pytest.raises(OSError), run_workspace() as workspace:
        run(path, workspace, tracker=tracker)
    assert tracker.stage.name == 'UNZIP_PACKAGE'

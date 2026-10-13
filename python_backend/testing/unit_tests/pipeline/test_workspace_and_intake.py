"""src/pipeline: one run folder per check (S4) and the intake that unpacks a package into it (plan PR 3.1)."""
import io
import os
import time
import zipfile

import pytest

import app.routes as routes
import app.utils as utils
from app import rate_limit
from run import app as flask_app
from src.checks.stages import States
from src.pipeline import workspace as workspace_module
from src.pipeline.intake import NOT_A_ZIP, Rejected, open_package
from src.pipeline.workspace import Workspace, run_workspace, sweep_stale, work_dir
from testing.fixtures.idml_builder import PackageBuilder


@pytest.fixture
def work(tmp_path, monkeypatch):
    monkeypatch.setenv('WORK_DIR', str(tmp_path / 'work'))
    return tmp_path / 'work'


def built_package(tmp_path, fonts_folder=None) -> str:
    pkg = PackageBuilder()
    pkg.text_frame(pkg.story([('Body', 'Hello')]))
    pkg.image('photo.jpg')
    path = pkg.write(tmp_path)
    if fonts_folder:
        with zipfile.ZipFile(path, 'a') as z:
            z.writestr(f'Template/{fonts_folder}/Font.otf', b'not a real font')
    return path


# --- workspace ----------------------------------------------------------------------------------------------------

def test_work_dir_comes_from_the_environment(work):
    assert work_dir() == str(work)


def test_run_workspace_is_removed_afterwards_even_on_error(work):
    with pytest.raises(RuntimeError):
        with run_workspace() as workspace:
            open(os.path.join(workspace.folder('upload'), 'x.zip'), 'w').close()
            assert os.path.dirname(workspace.path) == str(work)
            raise RuntimeError('boom')
    assert not os.path.exists(workspace.path)


def test_sweep_removes_only_stale_run_folders(work):
    old, fresh = Workspace.create(), Workspace.create()
    an_hour_ago = time.time() - workspace_module.STALE_AFTER_SECONDS - 60
    os.utime(old.path, (an_hour_ago, an_hour_ago))
    assert sweep_stale() == 1
    assert not os.path.exists(old.path) and os.path.exists(fresh.path)


def test_sweep_without_a_work_dir_does_nothing(work):
    assert sweep_stale() == 0


# --- intake --------------------------------------------------------------------------------------------------------

def test_open_package_unpacks_into_the_workspace(tmp_path, work):
    workspace = Workspace.create()
    intake = open_package(built_package(tmp_path), workspace)
    package = intake.package
    assert package.template_name == 'Template.zip'
    assert package.link_files == (('photo.jpg', 1024),)
    assert package.fonts_folder is None  # no Document fonts folder in the package, and none is made
    assert os.path.exists(os.path.join(intake.idml_folder, 'designmap.xml'))
    for path in (package.folder, package.idml_path, intake.idml_folder):
        assert path.startswith(workspace.path + os.sep)


@pytest.mark.parametrize('folder', ['Document fonts', 'Document Fonts'])
def test_document_fonts_folder_is_found_whatever_its_case(tmp_path, work, folder):
    intake = open_package(built_package(tmp_path, fonts_folder=folder), Workspace.create())
    assert os.path.basename(intake.package.fonts_folder) == folder


def test_not_a_zip_is_rejected_at_unzip_package(tmp_path, work):
    path = tmp_path / 'brief.pdf'
    path.write_bytes(b'%PDF')
    with pytest.raises(Rejected) as rejected:
        open_package(str(path), Workspace.create())
    assert (rejected.value.stage, rejected.value.classifier.name, rejected.value.reason) == \
        (States.UNZIP_PACKAGE, 'ZIP', 'File uploaded is not ZIP')


def test_damaged_zip_is_rejected_at_unzip_package(tmp_path, work):
    path = tmp_path / 'Template.zip'
    path.write_bytes(b'PK\x03\x04 not really a zip')
    with pytest.raises(Rejected) as rejected:
        open_package(str(path), Workspace.create())
    assert (rejected.value.stage, rejected.value.reason) == (States.UNZIP_PACKAGE, NOT_A_ZIP)


def test_package_without_an_idml_is_rejected_at_unzip_idml(tmp_path, work):
    path = tmp_path / 'Template.zip'
    with zipfile.ZipFile(path, 'w') as z:
        z.writestr('Template/Links/photo.jpg', b'x')
    with pytest.raises(Rejected) as rejected:
        open_package(str(path), Workspace.create())
    assert (rejected.value.stage, rejected.value.classifier.name) == (States.UNZIP_IDML, 'IDML')


# --- the app ---------------------------------------------------------------------------------------------------

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(routes, 'verify_supabase_token',
                        lambda token: {'sub': 'uid-1', 'email': 'approved@example.com'} if token == 'valid' else None)
    monkeypatch.setattr(routes.user_helpers, 'get_user_by_email', lambda email: {'id': 'user-1', 'email': email})
    monkeypatch.setattr(rate_limit, 'acquire', lambda bucket: (bucket, 'lease-1'))
    monkeypatch.setattr(rate_limit, 'hit', lambda bucket, limit, window: (True, 0))
    monkeypatch.setattr(rate_limit, 'release', lambda handle: None)
    monkeypatch.setattr(utils, 'log_analytics_to_supabase', lambda **kwargs: 'run-1')
    return flask_app.test_client()


def test_xml_export_is_sent_and_the_run_folder_is_removed(client, tmp_path):
    runs_before = set(os.listdir(work_dir()))
    with open(built_package(tmp_path), 'rb') as f:
        r = client.post('/v1/checks/xml', data={'file': (io.BytesIO(f.read()), 'Template.zip')},
                        headers={'Authorization': 'Bearer valid'}, content_type='multipart/form-data')
    assert r.status_code == 200
    with zipfile.ZipFile(io.BytesIO(r.get_data())) as export:  # read after the run folder is gone
        assert 'designmap.xml' in export.namelist()
    assert set(os.listdir(work_dir())) == runs_before

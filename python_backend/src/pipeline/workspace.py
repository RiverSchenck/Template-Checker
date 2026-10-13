"""Where a check run keeps its files: one folder per run under WORK_DIR, holding the upload, the unpacked package
and the XML export, removed when the run ends. sweep_stale() removes folders a killed run (timeout, out of
memory) left behind."""
import os
import shutil
import tempfile
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass

STALE_AFTER_SECONDS = 60 * 60


def work_dir() -> str:
    """WORK_DIR from the environment, else <system temp>/template-checker. Read on each call (tests set it)."""
    return os.environ.get('WORK_DIR') or os.path.join(tempfile.gettempdir(), 'template-checker')


@dataclass(frozen=True)
class Workspace:
    path: str

    @classmethod
    def create(cls) -> 'Workspace':
        """A new, empty run folder. Failing to make it is a server fault: it raises."""
        root = work_dir()
        os.makedirs(root, exist_ok=True)
        path = os.path.join(root, uuid.uuid4().hex)
        os.makedirs(path)
        return cls(path)

    def folder(self, name: str) -> str:
        """A subfolder of the run folder (made if needed)."""
        path = os.path.join(self.path, name)
        os.makedirs(path, exist_ok=True)
        return path

    def remove(self):
        shutil.rmtree(self.path, ignore_errors=True)


@contextmanager
def run_workspace():
    """A run folder for the length of a `with` block; removed afterwards, whatever happened."""
    workspace = Workspace.create()
    try:
        yield workspace
    finally:
        workspace.remove()


def sweep_stale(max_age_seconds: int = STALE_AFTER_SECONDS) -> int:
    """Remove run folders not touched for max_age_seconds (left by runs that were killed). Returns how many."""
    root = work_dir()
    if not os.path.isdir(root):
        return 0
    removed, now = 0, time.time()
    for name in os.listdir(root):
        path = os.path.join(root, name)
        try:
            if os.path.isdir(path) and now - os.path.getmtime(path) > max_age_seconds:
                shutil.rmtree(path, ignore_errors=True)
                removed += 1
        except OSError:  # removed by its own run meanwhile
            continue
    return removed

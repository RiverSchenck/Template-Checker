"""Golden results: the full checker output for every test package, stored as JSON.

A refactor must leave these unchanged. A deliberate behaviour change updates them in the same
commit, so the diff shows exactly what customers will see differently.

    python -m testing.golden            # report which packages differ
    python -m testing.golden --update   # rewrite the stored results
"""
import base64
import contextlib
import glob
import hashlib
import io
import json
import os

from PIL import Image

from src.pipeline.run import run as run_package
from src.pipeline.workspace import run_workspace

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TESTING_DIR = os.path.join(BACKEND_DIR, 'testing')
PACKAGES_DIR = os.path.join(TESTING_DIR, 'packages')
RESULTS_DIR = os.path.join(TESTING_DIR, 'golden', 'results')


def packages():
    """Every test package, by file name (testing/packages/; stable ids for parametrize and file names)."""
    return sorted(os.path.basename(p) for p in glob.glob(os.path.join(PACKAGES_DIR, '*.zip')))


def package_path(package: str) -> str:
    return os.path.join(PACKAGES_DIR, package)


def golden_path(package: str) -> str:
    return os.path.join(RESULTS_DIR, os.path.splitext(package)[0] + '.json')


def _canonical(value):
    """Previews are large base64 images: keep their format and size, so a missing or resized preview shows up."""
    if isinstance(value, dict):
        return {k: (_fingerprint(v) if k == 'preview' and isinstance(v, str) else _canonical(v))
                for k, v in value.items()}
    if isinstance(value, list):
        return [_canonical(v) for v in value]
    return value


def _fingerprint(text: str) -> str:
    """Not the pixels: pdfium draws some PDFs differently on macOS and Linux (e.g. a font that has no glyphs)."""
    try:
        with Image.open(io.BytesIO(base64.b64decode(text))) as image:
            return f'image:{image.format} {image.width}x{image.height}'
    except (ValueError, OSError):
        return 'sha256:' + hashlib.sha256(text.encode()).hexdigest()[:16]


def run(package: str) -> dict:
    """The checker's results for one package, minus anything that varies between runs."""
    with run_workspace() as workspace, contextlib.redirect_stdout(io.StringIO()):
        outcome = run_package(package_path(package), workspace)
    return {'stopped_at': outcome.stage.name, 'results': _canonical(outcome.json())}


def dumps(data: dict) -> str:
    return json.dumps(data, indent=1, sort_keys=True, ensure_ascii=False) + '\n'


def load(package: str):
    try:
        with open(golden_path(package), encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def save(package: str, data: dict):
    path = golden_path(package)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(dumps(data))


def first_differences(expected, actual, path='', limit=10):
    """Human-readable paths where two results differ, for test failure messages."""
    out = []
    if isinstance(expected, dict) and isinstance(actual, dict):
        for key in sorted(set(expected) | set(actual)):
            if key not in actual:
                out.append(f'{path}/{key}: removed')
            elif key not in expected:
                out.append(f'{path}/{key}: added')
            else:
                out += first_differences(expected[key], actual[key], f'{path}/{key}', limit)
            if len(out) >= limit:
                break
    elif isinstance(expected, list) and isinstance(actual, list) and len(expected) == len(actual):
        for i, (e, a) in enumerate(zip(expected, actual)):
            out += first_differences(e, a, f'{path}[{i}]', limit)
            if len(out) >= limit:
                break
    elif expected != actual:
        out.append(f'{path}: {json.dumps(expected)[:120]} -> {json.dumps(actual)[:120]}')
    return out[:limit]

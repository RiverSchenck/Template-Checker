"""Intake: an uploaded package zip -> the unpacked .idml and what the checks need from the package, in a run's
workspace. A package the checker can't use raises Rejected, with the stage it stopped at (stored in analytics)
and a reason the uploader can act on. Anything else that goes wrong (disk, permissions) is a server fault and
raises as it is.

Two steps, like the run's stages: unpack_package (UNZIP_PACKAGE), then unpack_idml (UNZIP_IDML).
"""
import os
import zipfile
from dataclasses import dataclass
from typing import Optional, Tuple

from src.checks.stages import States
from src.helpers.package_zip import (DAMAGED_ARCHIVE_ERRORS, MultipleIdmlError, NoIdmlError, PackageError,
                                     extract_idml, extract_package, read_package)
from src.pipeline.workspace import Workspace
from src.results.classifiers import Classifier, ValidationError

NOT_A_ZIP = "The file is not a valid ZIP archive. Please zip the package folder again and re-upload."


class Rejected(Exception):
    """The upload can't be checked. reason is written for the person who uploaded it."""

    def __init__(self, stage: States, classifier: Classifier, reason: str):
        super().__init__(reason)
        self.stage, self.classifier, self.reason = stage, classifier, reason


@dataclass(frozen=True)
class Package:
    """The package after unpack_package: its files are extracted, the .idml is not unpacked yet."""
    template_name: str              # the upload's file name
    folder: str                     # the folder holding the .idml (the package root)
    idml_path: Optional[str]        # None when there's no single .idml (reported by unpack_idml)
    idml_problem: Optional[str]
    link_files: Tuple[Tuple[str, int], ...]   # (name, size) per file in Links (listed, not extracted)
    fonts_folder: Optional[str]     # its Document fonts folder, None when it has none


@dataclass(frozen=True)
class Intake:
    package: Package
    idml_folder: str                # the unpacked .idml


def unpack_package(zip_path: str, workspace: Workspace) -> Package:
    """UNZIP_PACKAGE: check it's a zip, validate it from its directory, and extract only what the checks read
    (.idml, Document fonts, package PDF) into the workspace."""
    template_name = os.path.basename(zip_path)
    if not zip_path or not zip_path.lower().endswith('.zip'):
        raise Rejected(States.UNZIP_PACKAGE, ValidationError.ZIP, 'File uploaded is not ZIP')
    root = workspace.folder('package')
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            try:
                package = read_package(zip_ref)
            except (NoIdmlError, MultipleIdmlError) as e:
                return Package(template_name, root, None, str(e), (), None)
            folder, idml_path = extract_package(zip_ref, package, root)
    except PackageError as e:
        raise Rejected(States.UNZIP_PACKAGE, ValidationError.ERROR, str(e))
    except DAMAGED_ARCHIVE_ERRORS:
        raise Rejected(States.UNZIP_PACKAGE, ValidationError.ERROR, NOT_A_ZIP)
    fonts = next((os.path.join(folder, name) for name in sorted(os.listdir(folder))
                  if name.lower() == 'document fonts' and os.path.isdir(os.path.join(folder, name))), None)
    return Package(template_name, folder, idml_path, None, tuple(package.links), fonts)


def unpack_idml(package: Package, workspace: Workspace) -> Intake:
    """UNZIP_IDML: a missing or duplicate .idml is rejected here; otherwise the .idml is unpacked."""
    if package.idml_problem or not package.idml_path:
        raise Rejected(States.UNZIP_IDML, ValidationError.IDML, package.idml_problem or NoIdmlError().args[0])
    idml_folder = workspace.folder('idml')
    try:
        extract_idml(package.idml_path, idml_folder)
    except PackageError as e:
        raise Rejected(States.UNZIP_IDML, ValidationError.ERROR, str(e))
    return Intake(package, idml_folder)


def open_package(zip_path: str, workspace: Workspace) -> Intake:
    return unpack_idml(unpack_package(zip_path, workspace), workspace)

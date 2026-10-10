"""Shared setup for the per-check tests: a checker that has unpacked and parsed a package, ready for one check.

When the checker's internals move (refactor phase 2), only this function changes.
"""
from src.classes.FrontifyChecker import FrontifyChecker


def setup_instance(source_file_path: str) -> FrontifyChecker:
    checker = FrontifyChecker()
    checker.set_source_file_path(source_file_path)
    checker.unzip_package_state()
    checker.unzip_idml_state()
    checker.parse_xml()
    return checker

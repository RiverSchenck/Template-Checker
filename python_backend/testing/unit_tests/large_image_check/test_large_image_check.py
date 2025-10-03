import pytest
import os
from src.classes.FrontifyChecker import FrontifyChecker
from src.error_handling.ValidationClassifier import ValidationInfo
from collections import Counter

EXPECTED_OUTCOMES = {
    "2 large images.zip": {
        "errors": [
        ],
        "infos": [
            f"{ValidationInfo.LARGE_IMAGE.value}",
            f"{ValidationInfo.LARGE_IMAGE.value}",
        ]
    },
    "1 large image.zip": {
        "errors": [
        ],
        "infos": [
            f"{ValidationInfo.LARGE_IMAGE.value}",
        ]
    },
    "Large image used.zip": {
        "errors": [
        ],
        "infos": [
            f"{ValidationInfo.LARGE_IMAGE.value}",
        ]
    },
    "2 large images 1 small with same name Folder.zip": {
        "errors": [
        ],
        "infos": [
            f"{ValidationInfo.LARGE_IMAGE.value}",
            f"{ValidationInfo.LARGE_IMAGE.value}",
        ]
    },
}


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FAIL_DATA_DIR = os.path.join(BASE_DIR, 'fail_data')
PASS_DATA_DIR = os.path.join(BASE_DIR, 'pass_data')


def setup_instance(source_file_path):
    checkerInstance = FrontifyChecker()
    checkerInstance.set_source_file_path(source_file_path)
    checkerInstance.unzip_package_state()
    checkerInstance.cleanup_data_folder()
    checkerInstance.extract_zip_to_data_folder()
    checkerInstance.unzip_idml_state()
    checkerInstance.parse_xml()
    return checkerInstance


@pytest.mark.parametrize('testcase_zip', [os.path.join(FAIL_DATA_DIR, f) for f in os.listdir(FAIL_DATA_DIR) if f.endswith('.zip')])
def test_zip_check_fail(testcase_zip):
    print(f"Running FAIL test with {testcase_zip}")
    # Setup
    checker = setup_instance(testcase_zip)
    # Execute
    checker.large_image_check()
    # Cleanup files
    checker.delete_unzipped_root_path()

    # Extract Error and Warnings
    actual_errors = checker.get_error_types()
    actual_warnings = checker.get_warning_types()
    actual_infos = checker.get_info_types()

    print('Actual Errors:')
    for error in actual_errors:
        print(error)
    print("Actual Warnings:")
    for warning in actual_warnings:
        print(warning)
    print("Actual Infos:")
    for info in actual_infos:
        print(info)

    # Extract expected outcomes for the current testcase_zip
    filename = os.path.basename(testcase_zip)
    # If the expected outcome for the file is not found, skip the test
    if filename not in EXPECTED_OUTCOMES:
        pytest.skip(f"Expected outcome for {filename} not found")
    expected_errors = EXPECTED_OUTCOMES[filename].get("errors", [])
    expected_warnings = EXPECTED_OUTCOMES[filename].get("warnings", [])
    expected_infos = EXPECTED_OUTCOMES[filename].get("infos", [])

    actual_errors_count = Counter(actual_errors)
    expected_errors_count = Counter(expected_errors)

    actual_warnings_count = Counter(actual_warnings)
    expected_warnings_count = Counter(expected_warnings)

    actual_infos_count = Counter(actual_infos)
    expected_infos_count = Counter(expected_infos)

    assert actual_errors_count == expected_errors_count, f"Expected {expected_errors_count} but got {actual_errors_count}"
    assert actual_warnings_count == expected_warnings_count, f"Expected {expected_warnings_count} but got {actual_warnings_count}"
    assert actual_infos_count == expected_infos_count, f"Expected {expected_infos_count} but got {actual_infos_count}"


@pytest.mark.parametrize('testcase_zip', [os.path.join(PASS_DATA_DIR, f) for f in os.listdir(PASS_DATA_DIR) if f.endswith('.zip')])
def test_zip_check_pass(testcase_zip):
    print(f"Running PASS test with {testcase_zip}")
    # Setup
    checker = setup_instance(testcase_zip)
    # Exuecute
    checker.large_image_check()
    # Cleanup files
    checker.delete_unzipped_root_path()

    # Extract Error and Warnings
    actual_errors = checker.get_error_types()
    actual_warnings = checker.get_warning_types()
    actual_infos = checker.get_info_types()

    print('Actual Errors:')
    for error in actual_errors:
        print(error)
    print("Actual Warnings:")
    for warning in actual_warnings:
        print(warning)
    print("Actual Infos:")
    for info in actual_infos:
        print(info)

    # Assert
    assert not actual_errors

    assert not actual_warnings

    assert not actual_infos

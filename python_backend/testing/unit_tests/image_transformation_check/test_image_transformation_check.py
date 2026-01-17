import pytest
import os
from src.classes.FrontifyChecker import FrontifyChecker
from src.error_handling.ValidationClassifier import ValidationWarning, ValidationError
from collections import Counter

def format_counter_diff(expected: Counter, actual: Counter, label: str) -> tuple:
    """Format differences between expected and actual Counters in a readable way.
    Returns (detailed_message, summary_line) tuple."""
    if expected == actual:
        return ("", "")

    lines = [f"\n{label} Differences:"]
    summary_parts = []
    all_keys = set(expected.keys()) | set(actual.keys())

    for key in sorted(all_keys):
        expected_count = expected.get(key, 0)
        actual_count = actual.get(key, 0)

        if expected_count != actual_count:
            if actual_count > expected_count:
                diff = actual_count - expected_count
                lines.append(f"  {key}: Expected {expected_count}, Got {actual_count} (+{diff} extra)")
                summary_parts.append(f"{key}: +{diff}")
            else:
                diff = expected_count - actual_count
                lines.append(f"  {key}: Expected {expected_count}, Got {actual_count} (-{diff} missing)")
                summary_parts.append(f"{key}: -{diff}")

    detailed = "\n".join(lines)
    summary = f"DIFF: {', '.join(summary_parts)}"
    return (detailed, summary)

EXPECTED_OUTCOMES = {
    "Image Transformation Folder.zip": {
        "errors": [
            f"{ValidationError.IMAGE_TRANSFORMATION.value}",  # Flip
        ],
        "warnings": [
            f"{ValidationWarning.IMAGE_TRANSFORMATION.value}",  # Rotation
        ]
    },
    "Not Using paragraph style.zip": {
        "errors": [
        ],
        "warnings": [
            f"{ValidationWarning.IMAGE_TRANSFORMATION.value}",  # Rotation
            f"{ValidationWarning.IMAGE_TRANSFORMATION.value}",  # Rotation
        ]
    },
    "4 err 2 warn transformations.zip": {
        "errors": [
            f"{ValidationError.IMAGE_TRANSFORMATION.value}",  # Shear
            f"{ValidationError.IMAGE_TRANSFORMATION.value}",  # Flip
            f"{ValidationError.IMAGE_TRANSFORMATION.value}",  # Flip
        ],
        "warnings": [
            f"{ValidationWarning.IMAGE_TRANSFORMATION.value}",  # Rotation
            f"{ValidationWarning.IMAGE_TRANSFORMATION.value}",  # Rotation
        ]
    },
    "3 err 2 warn transformation.zip": {
        "errors": [
            f"{ValidationError.IMAGE_TRANSFORMATION.value}",  # Flip
            f"{ValidationError.IMAGE_TRANSFORMATION.value}",  # Flip
            f"{ValidationError.IMAGE_TRANSFORMATION.value}",  # Embedded
        ],
        "warnings": [
            f"{ValidationWarning.IMAGE_TRANSFORMATION.value}",  # Rotation
            f"{ValidationWarning.IMAGE_TRANSFORMATION.value}",  # Rotation
        ]
    }
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
    checker.image_transformation_check()
   # Cleanup files
    checker.delete_unzipped_root_path()

    # Extract Error and Warnings
    actual_errors = checker.get_error_types()
    actual_warnings = checker.get_warning_types()
    actual_infos = checker.get_info_types()


    # Extract expected outcomes for the current testcase_zip
    filename = os.path.basename(testcase_zip)
    # If the expected outcome for the file is not found, skip the test
    if filename not in EXPECTED_OUTCOMES:
        pytest.skip(f"Expected outcome for {filename} not found")
    expected_errors = EXPECTED_OUTCOMES[filename].get("errors", [])
    expected_warnings = EXPECTED_OUTCOMES[filename].get("warnings", [])
    expected_infos = EXPECTED_OUTCOMES[filename].get("infos", [])

    # Combine IMAGE_TRANSFORMATION_IMAGE and IMAGE_TRANSFORMATION_CONTAINER counts
    # for comparison with expected outcomes (which use the old IMAGE_TRANSFORMATION type)
    def combine_image_transformation_counts(counter):
        combined = Counter()
        image_transformation_total = 0
        for key, value in counter.items():
            if key in [ValidationError.IMAGE_TRANSFORMATION_IMAGE.value,
                       ValidationError.IMAGE_TRANSFORMATION_CONTAINER.value]:
                image_transformation_total += value
            else:
                combined[key] = value
        if image_transformation_total > 0:
            combined[ValidationError.IMAGE_TRANSFORMATION.value] = image_transformation_total
        return combined

    def combine_image_transformation_warning_counts(counter):
        combined = Counter()
        image_transformation_total = 0
        for key, value in counter.items():
            if key in [ValidationWarning.IMAGE_TRANSFORMATION_IMAGE.value,
                       ValidationWarning.IMAGE_TRANSFORMATION_CONTAINER.value]:
                image_transformation_total += value
            else:
                combined[key] = value
        if image_transformation_total > 0:
            combined[ValidationWarning.IMAGE_TRANSFORMATION.value] = image_transformation_total
        return combined

    actual_errors_count = combine_image_transformation_counts(Counter(actual_errors))
    expected_errors_count = Counter(expected_errors)

    actual_warnings_count = combine_image_transformation_warning_counts(Counter(actual_warnings))
    expected_warnings_count = Counter(expected_warnings)

    actual_infos_count = Counter(actual_infos)
    expected_infos_count = Counter(expected_infos)

    # Build readable diff message
    diff_detailed = ""
    diff_summary_parts = []
    if actual_errors_count != expected_errors_count:
        detailed, summary = format_counter_diff(expected_errors_count, actual_errors_count, "Errors")
        diff_detailed += detailed
        if summary:
            diff_summary_parts.append(summary)
    if actual_warnings_count != expected_warnings_count:
        detailed, summary = format_counter_diff(expected_warnings_count, actual_warnings_count, "Warnings")
        diff_detailed += detailed
        if summary:
            diff_summary_parts.append(summary)
    if actual_infos_count != expected_infos_count:
        detailed, summary = format_counter_diff(expected_infos_count, actual_infos_count, "Infos")
        diff_detailed += detailed
        if summary:
            diff_summary_parts.append(summary)

    if diff_detailed:
        print(diff_detailed)  # Print detailed differences so they're always visible
        # Create summary message for pytest.fail() that appears in summary line
        summary_msg = " | ".join(diff_summary_parts)
        pytest.fail(f"{summary_msg}\n{diff_detailed}")


@pytest.mark.parametrize('testcase_zip', [os.path.join(PASS_DATA_DIR, f) for f in os.listdir(PASS_DATA_DIR) if f.endswith('.zip')])
def test_zip_check_pass(testcase_zip):
    print(f"Running PASS test with {testcase_zip}")
    # Setup
    checker = setup_instance(testcase_zip)
    # Exuecute
    checker.image_transformation_check()
    # Cleanup files
    checker.delete_unzipped_root_path()

    # Extract Error and Warnings
    actual_errors = checker.get_error_types()
    actual_warnings = checker.get_warning_types()
    actual_infos = checker.get_info_types()

    # Assert
    assert not actual_errors

    assert not actual_warnings

    assert not actual_infos


@pytest.mark.parametrize('testcase_zip', [os.path.join(PASS_DATA_DIR, f) for f in os.listdir(PASS_DATA_DIR) if f.endswith('.zip')])
def test_zips_check_pass(testcase_zip):
    print(f"Running PASS test with {testcase_zip}")
    # Setup
    checker = setup_instance(testcase_zip)
    # Exuecute
    checker.image_transformation_check()
    # Cleanup files
    checker.delete_unzipped_root_path()

    # Extract Error and Warnings
    actual_errors = checker.get_error_types()
    actual_warnings = checker.get_warning_types()
    actual_infos = checker.get_info_types()


    # Assert
    assert not actual_errors

    assert not actual_warnings

    assert not actual_infos

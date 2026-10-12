"""Auto-size: Frontify supports every reference point, and always treats width-based auto-size as "No Line
Breaks" (docs/checker-rules.md). So only a missing "No Line Breaks" (or an unknown type) is an error."""
import pytest

from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder

POINTS = ['TopLeftPoint', 'TopCenterPoint', 'TopRightPoint', 'LeftCenterPoint', 'CenterPoint',
          'RightCenterPoint', 'BottomLeftPoint', 'BottomCenterPoint', 'BottomRightPoint', None]


def auto_size_errors(tmp_path, **frame):
    pkg = PackageBuilder()
    pkg.text_frame(pkg.story([('Body', 'Auto')]), **frame)
    return [i.context for i in run_checker(pkg.write(tmp_path)).of('AUTO_SIZE_TEXT_BOX')]


@pytest.mark.parametrize('point', POINTS)
@pytest.mark.parametrize('sizing', ['HeightOnly', 'WidthOnly', 'HeightAndWidth'])
def test_any_reference_point_is_fine(tmp_path, sizing, point):
    assert auto_size_errors(tmp_path, auto_size=sizing, reference_point=point, no_line_breaks=True) == []


@pytest.mark.parametrize('sizing', ['WidthOnly', 'HeightAndWidth'])
def test_width_based_auto_size_needs_no_line_breaks(tmp_path, sizing):
    assert auto_size_errors(tmp_path, auto_size=sizing, reference_point='CenterPoint', no_line_breaks=False) == [
        "'No Line Breaks' must be checked."]


def test_height_only_doesnt_need_no_line_breaks(tmp_path):
    assert auto_size_errors(tmp_path, auto_size='HeightOnly', reference_point='CenterPoint', no_line_breaks=False) == []

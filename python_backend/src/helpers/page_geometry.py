import os
from typing import Dict, List, Optional, Tuple
from lxml import etree as ET

from src.helpers.page_item_transform import parse_item_transform

Matrix = Tuple[float, float, float, float, float, float]
IDENTITY: Matrix = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)

# Page items drawn as outlines when a page has no preview image.
_FRAME_TAGS = frozenset({'TextFrame', 'Rectangle', 'Polygon', 'Oval', 'GraphicLine'})


def _local_tag(tag) -> str:
    if not isinstance(tag, str):
        return ''
    return tag.split('}', 1)[-1] if '}' in tag else tag


def _multiply(inner: Matrix, outer: Matrix) -> Matrix:
    """Compose two IDML transforms: apply `inner` first, then `outer`."""
    a1, b1, c1, d1, tx1, ty1 = inner
    a2, b2, c2, d2, tx2, ty2 = outer
    return (
        a1 * a2 + b1 * c2,
        a1 * b2 + b1 * d2,
        c1 * a2 + d1 * c2,
        c1 * b2 + d1 * d2,
        tx1 * a2 + ty1 * c2 + tx2,
        tx1 * b2 + ty1 * d2 + ty2,
    )


def _invert(m: Matrix) -> Optional[Matrix]:
    a, b, c, d, tx, ty = m
    det = a * d - b * c
    if abs(det) < 1e-12:
        return None
    ia, ib, ic, id_ = d / det, -b / det, -c / det, a / det
    return (ia, ib, ic, id_, -(tx * ia + ty * ic), -(tx * ib + ty * id_))


def _apply(m: Matrix, x: float, y: float) -> Tuple[float, float]:
    a, b, c, d, tx, ty = m
    return (a * x + c * y + tx, b * x + d * y + ty)


def _element_transform(el) -> Matrix:
    return parse_item_transform(el.get('ItemTransform')) or IDENTITY


# **********************************************************
# Class: PageGeometryIndex
# Init Locations: FrontifyChecker
# Methods calls from: ValidationResult
# Method calls to:
# Description: Resolves page item Self ids to bounding boxes in page
#              coordinates (points, origin top-left of the page) so the
#              frontend can draw issue highlights over page previews.
# **********************************************************
class PageGeometryIndex:
    def __init__(self, idml_output_folder: str):
        # Pages in document order: {self, name, index, width, height, spread_id}
        self.pages: List[Dict] = []
        # page Self -> (inverse page transform, left, top, width, height)
        self._page_frames: Dict[str, Tuple[Matrix, float, float, float, float]] = {}
        # spread Self -> page Selfs on that spread
        self._spread_pages: Dict[str, List[str]] = {}
        # element Self -> element (spread items only)
        self._elements: Dict[str, object] = {}
        self._bounds_cache: Dict[str, Optional[Dict]] = {}
        self._parse(idml_output_folder)

    # ---------------- Private Setters------------------
    def _spread_paths_in_order(self, idml_output_folder: str) -> List[str]:
        designmap = os.path.join(idml_output_folder, 'designmap.xml')
        if os.path.exists(designmap):
            root = ET.parse(designmap).getroot()
            paths = [el.get('src') for el in root.iter()
                     if _local_tag(el.tag) == 'Spread' and el.get('src')]
            if paths:
                return [os.path.join(idml_output_folder, p) for p in paths]
        spreads_dir = os.path.join(idml_output_folder, 'Spreads')
        if not os.path.isdir(spreads_dir):
            return []
        return [os.path.join(spreads_dir, f) for f in sorted(os.listdir(spreads_dir)) if f.endswith('.xml')]

    def _parse(self, idml_output_folder: str):
        parser = ET.XMLParser(huge_tree=True)
        for path in self._spread_paths_in_order(idml_output_folder):
            if not os.path.exists(path):
                continue
            spread = ET.parse(path, parser).getroot().find('.//Spread')
            if spread is None:
                continue
            spread_id = spread.get('Self', '')
            self._spread_pages[spread_id] = []
            for page in spread.findall('Page'):
                self._add_page(page, spread_id)
            for el in spread.iter():
                self_id = el.get('Self') if isinstance(el.tag, str) else None
                if self_id and _local_tag(el.tag) != 'Page':
                    self._elements[self_id] = el

    def _add_page(self, page, spread_id: str):
        page_id = page.get('Self')
        try:
            top, left, bottom, right = map(float, page.get('GeometricBounds', '').split())
        except ValueError:
            return
        inverse = _invert(_element_transform(page))
        if not page_id or inverse is None:
            return
        width, height = right - left, bottom - top
        self._page_frames[page_id] = (inverse, left, top, width, height)
        self._spread_pages[spread_id].append(page_id)
        self.pages.append({
            'page_id': page_id,
            'name': page.get('Name', ''),
            'index': len(self.pages) + 1,
            'spread_id': spread_id,
            'width': width,
            'height': height,
        })

    def _transform_to_spread(self, el) -> Matrix:
        """Compose ItemTransforms from `el` up to (excluding) the Spread."""
        m = IDENTITY
        node = el
        while node is not None and _local_tag(node.tag) != 'Spread':
            if node.get('ItemTransform'):
                m = _multiply(m, _element_transform(node))
            node = node.getparent()
        return m

    def _spread_points(self, el) -> List[Tuple[float, float]]:
        """All path anchors of `el` and its descendants, in spread coordinates."""
        points = []
        for anchor_el in el.iter('PathPointType'):
            anchor = anchor_el.get('Anchor')
            if not anchor:
                continue
            try:
                x, y = map(float, anchor.split())
            except ValueError:
                continue
            # PathPointType -> PathPointArray -> GeometryPathType -> PathGeometry -> Properties -> owner
            owner = anchor_el
            for _ in range(5):
                owner = owner.getparent() if owner is not None else None
            if owner is None:
                continue
            points.append(_apply(self._transform_to_spread(owner), x, y))
        return points

    def _spread_of(self, el) -> str:
        node = el
        while node is not None and _local_tag(node.tag) != 'Spread':
            node = node.getparent()
        return node.get('Self', '') if node is not None else ''

    def _compute_bounds(self, self_id: str) -> Optional[Dict]:
        el = self._elements.get(self_id)
        # Links and images carry no geometry of their own; climb to the frame that does.
        points: List[Tuple[float, float]] = []
        while el is not None and _local_tag(el.tag) != 'Spread':
            points = self._spread_points(el)
            if points:
                break
            el = el.getparent()
        if not points:
            return None

        best = None
        for page_id in self._spread_pages.get(self._spread_of(el), []):
            inverse, left, top, width, height = self._page_frames[page_id]
            local = [_apply(inverse, x, y) for x, y in points]
            xs = [p[0] - left for p in local]
            ys = [p[1] - top for p in local]
            box = (min(xs), min(ys), max(xs), max(ys))
            # Pick the page that overlaps the item the most.
            overlap = max(0.0, min(box[2], width) - max(box[0], 0.0)) * \
                max(0.0, min(box[3], height) - max(box[1], 0.0))
            if best is None or overlap > best[0]:
                best = (overlap, page_id, box)
        if best is None:
            return None
        _, page_id, (x0, y0, x1, y1) = best
        return {
            'page_id': page_id,
            'kind': _local_tag(el.tag),
            'x': round(x0, 2),
            'y': round(y0, 2),
            'width': round(x1 - x0, 2),
            'height': round(y1 - y0, 2),
        }

    # ----------------Getters------------------
    def get_bounds(self, self_id: str) -> Optional[Dict]:
        """Bounding box of a page item in its page's coordinates, or None if unknown."""
        if not self_id or self_id == 'null':
            return None
        if self_id not in self._bounds_cache:
            self._bounds_cache[self_id] = self._compute_bounds(self_id)
        return self._bounds_cache[self_id]

    def get_pages(self) -> List[Dict]:
        return self.pages

    def get_page_frames(self) -> Dict[str, List[Dict]]:
        """Outline of every frame per page Self, for drawing a wireframe of the page."""
        frames: Dict[str, List[Dict]] = {page['page_id']: [] for page in self.pages}
        for self_id, el in self._elements.items():
            kind = _local_tag(el.tag)
            if kind not in _FRAME_TAGS:
                continue
            bounds = self.get_bounds(self_id)
            if bounds and bounds['page_id'] in frames:
                frames[bounds['page_id']].append({**bounds, 'kind': kind})
        return frames

"""Short notes in plain words about one issue, made from its facts: results v2 `note` (shown next to each place in the
web app) and the customer summary's details. The one copy of this wording.

Notes say only what the check's title and the place's own label don't, e.g. "font and size changed" or
"Current bleed: 3 mm on all sides". Raw values (skew factors, link ids, property names) are never shown.
"""
from decimal import ROUND_HALF_UP, Decimal
from typing import Dict, Iterable, List, Optional


def plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def list_text(items: List[str]) -> str:
    return ''.join(items) if len(items) <= 1 else f"{', '.join(items[:-1])} and {items[-1]}"


def round_half_up(value: float, places: int = 0) -> str:
    """'89.5' -> '90', '0.35' -> '0.4', '3.0' -> '3': halves round up, trailing zeros dropped."""
    rounded = Decimal(str(value)).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)
    text = f'{rounded:f}'
    if '.' in text:
        text = text.rstrip('0').rstrip('.')
    return '0' if text in ('-0', '') else text


def _unique(values: Iterable[str]) -> List[str]:
    return list(dict.fromkeys(values))


# Auto-size types Frontify always treats as "No Line Breaks" (src/checks/layout.py auto_size_text_box_check).
WIDTH_AUTO_SIZE = ('WidthOnly', 'HeightAndWidth')

# Overridden properties customers would recognise, in the order InDesign shows them. Others (e.g. MiterLimit) are
# left out.
_OVERRIDE_NAMES = {
    'AppliedFont': 'font',
    'FontStyle': 'font',
    'PointSize': 'size',
    'Leading': 'leading',
    'Tracking': 'tracking',
    'Capitalization': 'capitalization',
    'FillColor': 'color',
}

_ELEMENT_NAMES = {
    'TextFrame': 'text frame',
    'Rectangle': 'rectangle',
    'Oval': 'oval',
    'Polygon': 'polygon',
    'GraphicLine': 'line',
    'Group': 'group',
}


def overrides_note(properties: Iterable[str]) -> Optional[str]:
    """Which formatting was changed by hand, e.g. "font and size changed"; None when it's nothing recognisable."""
    changed = set(properties)
    names = _unique(name for prop, name in _OVERRIDE_NAMES.items() if prop in changed)
    if not names:
        return None
    listed = f"{', '.join(names[:3])} and more" if len(names) > 3 else list_text(names)
    return f'{listed} changed'


def _pt_to_mm(pt: float) -> str:
    return f'{round_half_up(pt * 25.4 / 72, 1)} mm'


def bleed_note(bleed: Dict[str, Optional[float]]) -> Optional[str]:
    """"Current bleed: 3 mm on all sides", or each side when they differ."""
    sides = [(side, _pt_to_mm(pt)) for side, pt in bleed.items() if pt is not None]
    if not sides:
        return None
    sizes = _unique(size for _, size in sides)
    described = f'{sizes[0]} on all sides' if len(sizes) == 1 else ', '.join(f'{side} {size}' for side, size in sides)
    return f'Current bleed: {described}'


def master_page_note(counts: Dict[str, int]) -> Optional[str]:
    """"Found on the master page: 6 groups", from element kind -> count."""
    items = [plural(n, _ELEMENT_NAMES.get(kind, kind.lower())) for kind, n in counts.items()]
    return f'Found on the master page: {list_text(items)}' if items else None


def _style_name(self_id: str) -> Optional[str]:
    """A style's name as InDesign's panels show it, from its Self; None for the root style every style is based on."""
    name = self_id.split('/', 1)[-1].removeprefix('$ID/')
    if name.startswith('[No '):
        return None
    return {'NormalParagraphStyle': '[Basic Paragraph]', 'NormalCharacterStyle': '[None]'}.get(name, name)


def note(check: str, facts: Optional[dict]) -> Optional[str]:
    """The note for one issue, or None when there's nothing to add."""
    facts = facts or {}
    if check == 'OVERRIDE':
        return overrides_note(facts.get('overrides') or {})
    if check == 'DOCUMENT_BLEED':
        return bleed_note(facts.get('bleed') or {})
    if check == 'MASTERPAGE':
        counts: Dict[str, int] = {}
        for element in facts.get('elements') or ():
            counts[element['kind']] = counts.get(element['kind'], 0) + element['count']
        return master_page_note(counts)
    if check == 'PASTED_GRAPHICS' and facts.get('count'):
        return plural(facts['count'], 'pasted graphic')
    if check == 'AUTO_SIZE_TEXT_BOX' and facts.get('auto_size') in WIDTH_AUTO_SIZE:
        return 'turn on No Line Breaks'
    if check == 'TRANSFORMATION' and facts.get('kind'):
        return 'flipped' if facts['kind'] == 'flip' else 'skewed'
    if check == 'PARAGRAPH_STYLE' and facts.get('whitespace_only'):
        return 'only spaces or empty lines'
    if check in ('FONTS_INCLUDED', 'ADOBE_FONT') and 'missing_styles' in facts:
        if facts.get('whole_family') or not facts['missing_styles']:
            return 'whole family missing'
        return f"{list_text(facts['missing_styles'])} missing"
    if check == 'LARGE_IMAGE' and facts.get('size_mb') is not None:
        return f"{facts['size_mb']} MB"
    if facts.get('inherited_from'):
        base = _style_name(facts['inherited_from'])
        return f'set in “{base}”' if base else None
    return None

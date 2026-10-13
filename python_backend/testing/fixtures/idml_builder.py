"""Build tiny, valid template packages in memory, so each edge case is a short readable test.

Defaults produce a clean package: every check passes. A test changes only what it is about:

    pkg = PackageBuilder()
    story = pkg.story([('Body', 'Hello')])
    pkg.text_frame(story, columns=2)          # -> one TEXT_COLUMNS error
    results = run_checker(pkg.write(tmp_path))

Pages are US Letter (612 x 792 pt). Frame positions are page-local (x, y, width, height) in points.
"""
import io
import os
import zipfile
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple
from xml.sax.saxutils import quoteattr, escape

PAGE_W, PAGE_H = 612, 792
NS = 'xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"'

# The root paragraph style carries a passing value for everything the checks read.
ROOT_PARAGRAPH_STYLE = {
    'KerningMethod': '$ID/Metrics', 'Composer': 'HL Single', 'GridAlignment': 'None',
    'Hyphenation': 'false', 'FillTint': '-1',
}
DEFAULT_TEXT_FRAME_STYLE = 'ObjectStyle/$ID/[Normal Text Frame]'
DEFAULT_GRAPHIC_STYLE = 'ObjectStyle/$ID/[None]'


def _attrs(values: Dict[str, Optional[str]]) -> str:
    return ' '.join(f'{k}={quoteattr(str(v))}' for k, v in values.items() if v is not None)


def _rect_path(x: float, y: float, w: float, h: float) -> str:
    points = [(x, y), (x, y + h), (x + w, y + h), (x + w, y)]
    anchors = ''.join(f'<PathPointType Anchor="{px} {py}" LeftDirection="{px} {py}" RightDirection="{px} {py}"/>'
                      for px, py in points)
    return (f'<Properties><PathGeometry><GeometryPathType PathOpen="false"><PathPointArray>{anchors}'
            f'</PathPointArray></GeometryPathType></PathGeometry></Properties>')


def _wrap_xml(wrap: Optional[str]) -> str:
    return f'<TextWrapPreference TextWrapMode="{wrap}"/>' if wrap is not None else ''


def _font_xml(font: Optional[str]) -> str:
    return f'<AppliedFont type="string">{escape(font)}</AppliedFont>' if font else ''


def _properties_xml(inner: str) -> str:
    return f'<Properties>{inner}</Properties>' if inner else ''


def _font_file(family: str, style: str, postscript: str) -> bytes:
    """A minimal TrueType font whose name table says family / style / PostScript name."""
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen

    builder = FontBuilder(1000, isTTF=True)
    builder.setupGlyphOrder(['.notdef'])
    builder.setupCharacterMap({})
    pen = TTGlyphPen(None)
    pen.moveTo((0, 0)); pen.lineTo((0, 500)); pen.lineTo((500, 0)); pen.closePath()
    builder.setupGlyf({'.notdef': pen.glyph()})
    builder.setupHorizontalMetrics({'.notdef': (500, 0)})
    builder.setupHorizontalHeader(ascent=800, descent=-200)
    builder.setupNameTable({'familyName': family, 'styleName': style, 'psName': postscript})
    builder.setupOS2()
    builder.setupPost()
    out = io.BytesIO()
    builder.save(out)
    return out.getvalue()


@dataclass
class _Paragraph:
    style: str
    runs: List[Tuple[str, Dict[str, str]]]  # (text, character-range attributes)
    attrs: Dict[str, str]


@dataclass
class PackageBuilder:
    name: str = 'Template'
    pages: int = 1                      # 2 = one facing-page spread
    master_spreads: bool = True
    masters: int = 1                    # number of master spread files
    bleed: str = '0'
    _paragraph_styles: Dict[str, Dict] = field(default_factory=dict)
    _character_styles: Dict[str, Dict] = field(default_factory=dict)
    _stories: Dict[str, List[_Paragraph]] = field(default_factory=dict)
    _items: List[str] = field(default_factory=list)
    _links: Dict[str, bytes] = field(default_factory=dict)
    _master_items: Dict[int, List[str]] = field(default_factory=dict)
    _font_families: Dict[str, Dict[str, Tuple[Optional[str], Optional[str]]]] = field(default_factory=dict)
    _document_fonts: Dict[str, bytes] = field(default_factory=dict)
    _next_id: int = 0x100

    def __post_init__(self):
        self.paragraph_style('Body')

    def _id(self) -> str:
        self._next_id += 1
        return f'u{self._next_id:x}'

    # --- styles ----------------------------------------------------------------------------
    def paragraph_style(self, name: str, based_on: Optional[str] = None, font: Optional[str] = None, **attrs: str):
        """A paragraph style; inherits from [No paragraph style] unless based_on names another style.
        font sets its AppliedFont (a family name, stored under Properties as InDesign does)."""
        self._paragraph_styles[name] = {'based_on': based_on, 'font': font, 'attrs': attrs}

    def character_style(self, name: str, based_on: Optional[str] = None, font: Optional[str] = None, **attrs: str):
        self._character_styles[name] = {'based_on': based_on, 'font': font, 'attrs': attrs}

    # --- fonts -----------------------------------------------------------------------------
    def font_family(self, name: str, faces: Dict[str, Tuple[Optional[str], Optional[str]]]):
        """A family in Fonts.xml. faces: {style name: (PostScript name, TypekitID)}."""
        self._font_families[name] = faces

    def document_font(self, family: str, style: str, postscript: str, file_name: Optional[str] = None):
        """A font file in Document fonts, generated with the given family, style and PostScript names."""
        self._document_fonts[file_name or f'{postscript}.ttf'] = _font_file(family, style, postscript)

    # --- content ---------------------------------------------------------------------------
    def story(self, paragraphs: Sequence, story_id: Optional[str] = None) -> str:
        """paragraphs: (paragraph style name, text) or (style, [(text, {char-range attrs}), ...], {para attrs})."""
        story_id = story_id or self._id()
        parsed = []
        for p in paragraphs:
            style, content = p[0], p[1]
            runs = [(content, {})] if isinstance(content, str) else list(content)
            parsed.append(_Paragraph(style, runs, p[2] if len(p) > 2 else {}))
        self._stories[story_id] = parsed
        return story_id

    def text_frame(self, story_id: str, page: int = 0, at=(72, 72, 200, 100), *, columns: int = 1,
                   wrap: Optional[str] = 'None', object_style: str = DEFAULT_TEXT_FRAME_STYLE,
                   auto_size: Optional[str] = None, reference_point: Optional[str] = None,
                   no_line_breaks: Optional[bool] = None, previous: str = 'n', next: str = 'n',
                   transform: Optional[str] = None) -> str:
        frame_id = self._id()
        pref = _attrs({'TextColumnCount': str(columns), 'AutoSizingType': auto_size or 'Off',
                       'AutoSizingReferencePoint': reference_point,
                       'UseNoLineBreaksForAutoSizing': None if no_line_breaks is None else str(no_line_breaks).lower()})
        wrap_xml = f'<TextWrapPreference TextWrapMode="{wrap}"/>' if wrap is not None else ''
        self._items.append(
            f'<TextFrame {_attrs({"Self": frame_id, "ParentStory": story_id, "PreviousTextFrame": previous, "NextTextFrame": next, "AppliedObjectStyle": object_style, "ItemTransform": transform or self._page_transform(page)})}>'
            f'{_rect_path(*at)}<TextFramePreference {pref}/>{wrap_xml}</TextFrame>')
        return frame_id

    def image(self, file_name: str, page: int = 0, at=(72, 300, 200, 150), *, include_in_links: bool = True,
              embedded: bool = False, image_transform: str = '1 0 0 1 0 0', frame_transform: Optional[str] = None,
              frame_style: str = DEFAULT_GRAPHIC_STYLE, image_style: str = DEFAULT_GRAPHIC_STYLE,
              size_bytes: int = 1024, master: Optional[int] = None, broken_link: bool = False,
              wrap: Optional[str] = None) -> str:
        """A placed image. master=N puts it on master spread N instead of the page; broken_link omits the
        link's LinkResourceURI (a malformed export); wrap sets the frame's TextWrapMode."""
        frame_id, image_id, link_id = self._id(), self._id(), self._id()
        if include_in_links:
            self._links[file_name] = b'\0' * size_bytes
        stored = 'Embedded' if embedded else 'Normal'
        uri = None if broken_link else f'file:/Users/designer/{self.name}/Links/{file_name}'
        xml = (f'<Rectangle {_attrs({"Self": frame_id, "ContentType": "GraphicType", "AppliedObjectStyle": frame_style, "ItemTransform": frame_transform or self._page_transform(page)})}>'
               f'{_rect_path(*at)}{_wrap_xml(wrap)}'
               f'<Image {_attrs({"Self": image_id, "AppliedObjectStyle": image_style, "ItemTransform": image_transform})}>'
               f'<Link {_attrs({"Self": link_id, "LinkResourceURI": uri, "StoredState": stored})}/>'
               f'</Image></Rectangle>')
        if master is None:
            self._items.append(xml)
        else:
            self._master_items.setdefault(master, []).append(xml)
        return frame_id

    def shape(self, tag: str = 'Rectangle', page: int = 0, at=(72, 300, 200, 150), *, wrap: Optional[str] = None,
              pasted: Optional[str] = None, transform: Optional[str] = None) -> str:
        """An empty Rectangle, Oval, Polygon or GraphicLine. pasted='PDF'/'EPS'/'Image'/'SVG' puts a graphic
        pasted into the document inside it (inline Contents, no Link)."""
        item_id = self._id()
        inner = ''
        if pasted:
            inner = (f'<{pasted} Self="{self._id()}" ItemTransform="1 0 0 1 0 0"><Properties>'
                     f'<Contents><![CDATA[UGFzdGVkIGdyYXBoaWM=]]></Contents></Properties></{pasted}>')
        self._items.append(
            f'<{tag} {_attrs({"Self": item_id, "ContentType": "GraphicType" if pasted else "Unassigned", "AppliedObjectStyle": DEFAULT_GRAPHIC_STYLE, "ItemTransform": transform or self._page_transform(page)})}>'
            f'{_rect_path(*at)}{_wrap_xml(wrap)}{inner}</{tag}>')
        return item_id

    def group(self, page: int = 0, at=(72, 300, 200, 150), *, wrap: Optional[str] = None) -> str:
        """A group holding one empty rectangle; wrap sets the group's TextWrapMode."""
        group_id, child_id = self._id(), self._id()
        self._items.append(
            f'<Group {_attrs({"Self": group_id, "AppliedObjectStyle": DEFAULT_GRAPHIC_STYLE, "ItemTransform": self._page_transform(page)})}>'
            f'{_wrap_xml(wrap)}'
            f'<Rectangle {_attrs({"Self": child_id, "ContentType": "Unassigned", "AppliedObjectStyle": DEFAULT_GRAPHIC_STYLE, "ItemTransform": "1 0 0 1 0 0"})}>'
            f'{_rect_path(*at)}</Rectangle></Group>')
        return group_id

    def _page_transform(self, page: int) -> str:
        """Page-local coordinates -> spread coordinates (the spread origin is at the spine, mid-height)."""
        x = -PAGE_W * self.pages / 2 + PAGE_W * page if self.pages > 1 else 0
        return f'1 0 0 1 {x} {-PAGE_H / 2}'

    # --- output ----------------------------------------------------------------------------
    def _styles_xml(self) -> str:
        root = _attrs({'Self': 'ParagraphStyle/$ID/[No paragraph style]', 'Name': '$ID/[No paragraph style]', **ROOT_PARAGRAPH_STYLE})
        paragraphs = [f'<ParagraphStyle {root}/>',
                      '<ParagraphStyle Self="ParagraphStyle/$ID/NormalParagraphStyle" Name="$ID/NormalParagraphStyle">'
                      '<Properties><BasedOn type="string">$ID/[No paragraph style]</BasedOn></Properties></ParagraphStyle>']
        for name, s in self._paragraph_styles.items():
            base = s['based_on'] or '$ID/[No paragraph style]'
            base = base if base.startswith('$ID/') else f'ParagraphStyle/{base}'
            paragraphs.append(f'<ParagraphStyle {_attrs({"Self": f"ParagraphStyle/{name}", "Name": name, **s["attrs"]})}>'
                              f'<Properties><BasedOn type="string">{escape(base)}</BasedOn>{_font_xml(s["font"])}</Properties></ParagraphStyle>')
        characters = ['<CharacterStyle Self="CharacterStyle/$ID/[No character style]" Name="$ID/[No character style]"/>']
        for name, s in self._character_styles.items():
            base = s['based_on'] or '$ID/[No character style]'
            base = base if base.startswith('$ID/') else f'CharacterStyle/{base}'
            characters.append(f'<CharacterStyle {_attrs({"Self": f"CharacterStyle/{name}", "Name": name, **s["attrs"]})}>'
                              f'<Properties><BasedOn type="string">{escape(base)}</BasedOn>{_font_xml(s["font"])}</Properties></CharacterStyle>')
        return (f'<idPkg:Styles {NS}><RootCharacterStyleGroup>{"".join(characters)}</RootCharacterStyleGroup>'
                f'<RootParagraphStyleGroup>{"".join(paragraphs)}</RootParagraphStyleGroup></idPkg:Styles>')

    def _fonts_xml(self) -> str:
        families = ''.join(
            f'<FontFamily {_attrs({"Self": f"di{i}", "Name": family})}>'
            + ''.join(f'<Font {_attrs({"Self": f"di{i}Font{j}", "FontFamily": family, "Name": f"{family} {style}", "PostScriptName": ps, "Status": "Installed", "FontStyleName": style, "FontType": "OpenTypeCFF", "TypekitID": typekit})}/>'
                      for j, (style, (ps, typekit)) in enumerate(faces.items()))
            + '</FontFamily>'
            for i, (family, faces) in enumerate(self._font_families.items()))
        return f'<idPkg:Fonts {NS}>{families}</idPkg:Fonts>'

    def _story_xml(self, story_id: str, paragraphs: List[_Paragraph]) -> str:
        body = ''
        for p in paragraphs:
            style = p.style if p.style.startswith('$ID/') else p.style
            runs = ''.join(
                f'<CharacterStyleRange {_attrs({"AppliedCharacterStyle": attrs.pop("AppliedCharacterStyle", "CharacterStyle/$ID/[No character style]"), **{k: v for k, v in attrs.items() if k != "AppliedFont"}})}>'
                f'{_properties_xml(_font_xml(attrs.get("AppliedFont")))}<Content>{escape(text)}</Content></CharacterStyleRange>'
                for text, attrs in ((t, dict(a)) for t, a in p.runs))
            body += f'<ParagraphStyleRange {_attrs({"AppliedParagraphStyle": f"ParagraphStyle/{style}", **p.attrs})}>{runs}</ParagraphStyleRange>'
        return f'<idPkg:Story {NS}><Story Self="{story_id}">{body}</Story></idPkg:Story>'

    def _spread_xml(self) -> str:
        pages = ''.join(
            f'<Page Self="page{i}" Name="{i + 1}" GeometricBounds="0 0 {PAGE_H} {PAGE_W}" ItemTransform="{self._page_transform(i)}"/>'
            for i in range(self.pages))
        return f'<idPkg:Spread {NS}><Spread Self="spread1" PageCount="{self.pages}">{pages}{"".join(self._items)}</Spread></idPkg:Spread>'

    def idml_bytes(self) -> bytes:
        files = {
            'mimetype': 'application/vnd.adobe.indesign-idml-package',
            'designmap.xml': f'<Document {NS}>'
                             + ''.join(f'<idPkg:MasterSpread src="MasterSpreads/MasterSpread_m{m + 1}.xml"/>'
                                       for m in range(self.masters if self.master_spreads else 0))
                             + '<idPkg:Spread src="Spreads/Spread_spread1.xml"/>'
                             + ''.join(f'<idPkg:Story src="Stories/Story_{s}.xml"/>' for s in self._stories)
                             + '</Document>',
            'Resources/Fonts.xml': self._fonts_xml(),
            'Resources/Styles.xml': self._styles_xml(),
            'Resources/Preferences.xml': f'<idPkg:Preferences {NS}><DocumentPreference '
                                         + ' '.join(f'DocumentBleed{k}Offset="{self.bleed}"' for k in ('Top', 'Bottom', 'InsideOrLeft', 'OutsideOrRight'))
                                         + '/></idPkg:Preferences>',
            'Spreads/Spread_spread1.xml': self._spread_xml(),
        }
        for m in range(self.masters if self.master_spreads else 0):
            items = ''.join(self._master_items.get(m, []))
            files[f'MasterSpreads/MasterSpread_m{m + 1}.xml'] = (
                f'<idPkg:MasterSpread {NS}><MasterSpread Self="m{m + 1}"><Properties/><Page Self="mpage{m + 1}"/>{items}</MasterSpread></idPkg:MasterSpread>')
        for story_id, paragraphs in self._stories.items():
            files[f'Stories/Story_{story_id}.xml'] = self._story_xml(story_id, paragraphs)
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            for name, text in files.items():
                zf.writestr(name, '<?xml version="1.0" encoding="UTF-8"?>' + text if name.endswith('.xml') else text)
        return buf.getvalue()

    def write(self, directory) -> str:
        """Write the package zip (Name/Name.idml + Name/Links/...) and return its path."""
        path = os.path.join(str(directory), f'{self.name}.zip')
        with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(f'{self.name}/{self.name}.idml', self.idml_bytes())
            for file_name, data in self._links.items():
                zf.writestr(f'{self.name}/Links/{file_name}', data)
            for file_name, data in self._document_fonts.items():
                zf.writestr(f'{self.name}/Document fonts/{file_name}', data)
        return path

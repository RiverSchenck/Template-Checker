import React from 'react';
import { PageBounds, PageLayout, ValidationType } from '../../../types';
import { cn } from '../../../lib/utils';

/** A highlighted box on the page. */
export type CanvasMarker = {
  key: string;
  bounds: PageBounds;
  severity: ValidationType;
  title: string;
};

export const severityStyles: Record<
  ValidationType,
  { box: string; boxSelected: string; badge: string; text: string; dot: string }
> = {
  errors: {
    box: 'border-red-500 bg-red-500/10',
    boxSelected: 'border-red-500 bg-red-500/15',
    badge: 'bg-red-500 text-white',
    text: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
  },
  warnings: {
    box: 'border-amber-500 bg-amber-500/10',
    boxSelected: 'border-amber-500 bg-amber-500/15',
    badge: 'bg-amber-500 text-black',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  infos: {
    box: 'border-blue-500 bg-blue-500/10',
    boxSelected: 'border-blue-500 bg-blue-500/15',
    badge: 'bg-blue-500 text-white',
    text: 'text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
};

/** Boxes smaller than this (in points) are grown so they stay visible and clickable. */
const MIN_SIZE_PT = 12;
/** Markers sit this many pixels outside the frame so they wrap the content instead of cutting into it. */
const MARKER_OUTSET_PX = 3;

type Box = { x: number; y: number; width: number; height: number; offPage: boolean };

/**
 * Where to draw a frame: clipped to the page, grown if tiny, and pinned to the page edge
 * when it sits (mostly) on the pasteboard so it's never silently invisible.
 */
export function placeOnPage(b: PageBounds, page: PageLayout): Box {
  const x0 = Math.max(0, b.x);
  const y0 = Math.max(0, b.y);
  const x1 = Math.min(page.width, b.x + b.width);
  const y1 = Math.min(page.height, b.y + b.height);
  const visibleArea = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const offPage = visibleArea < 0.25 * Math.max(1, b.width * b.height);

  let box = { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
  if (offPage) {
    // Pin a small marker to the nearest page edge.
    const cx = Math.min(Math.max(b.x + b.width / 2, 0), page.width);
    const cy = Math.min(Math.max(b.y + b.height / 2, 0), page.height);
    box = { x: cx, y: cy, width: 0, height: 0 };
  }
  const minW = Math.min(MIN_SIZE_PT, page.width);
  const minH = Math.min(MIN_SIZE_PT, page.height);
  if (box.width < minW) box = { ...box, x: box.x - (minW - box.width) / 2, width: minW };
  if (box.height < minH) box = { ...box, y: box.y - (minH - box.height) / 2, height: minH };
  box.x = Math.min(Math.max(box.x, 0), page.width - box.width);
  box.y = Math.min(Math.max(box.y, 0), page.height - box.height);
  return { ...box, offPage };
}

const pct = (value: number, total: number) => `${(value / total) * 100}%`;

type PageCanvasProps = {
  page: PageLayout;
  markers: CanvasMarker[];
  selectedKey?: string | null;
  hoverKey?: string | null;
  showOutlines?: boolean;
  onHover?: (key: string | null) => void;
  onSelect?: (key: string) => void;
  /** Label shown on the selected box. */
  selectedLabel?: string;
};

function PageCanvas({
  page,
  markers,
  selectedKey = null,
  hoverKey = null,
  showOutlines = false,
  onHover,
  onSelect,
  selectedLabel,
}: PageCanvasProps) {
  const outlines = !page.preview || showOutlines;
  const style = (b: { x: number; y: number; width: number; height: number }, outset = 0) => ({
    left: `calc(${pct(b.x, page.width)} - ${outset}px)`,
    top: `calc(${pct(b.y, page.height)} - ${outset}px)`,
    width: `calc(${pct(b.width, page.width)} + ${outset * 2}px)`,
    height: `calc(${pct(b.height, page.height)} + ${outset * 2}px)`,
  });

  return (
    <div
      className="relative w-full overflow-hidden rounded-sm bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08),0_12px_32px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/10"
      style={{ aspectRatio: `${page.width} / ${page.height}` }}
    >
      {page.preview && (
        <img
          src={`data:image/jpeg;base64,${page.preview}`}
          alt={`Preview of page ${page.name}`}
          className={cn('absolute inset-0 h-full w-full select-none', showOutlines && 'opacity-50')}
          draggable={false}
        />
      )}
      {outlines &&
        page.frames.map((frame, i) => (
          <div key={i} className="pointer-events-none absolute border border-dashed border-slate-400/80" style={style(frame)} />
        ))}
      {markers.map((marker) => {
        const box = placeOnPage(marker.bounds, page);
        const selected = marker.key === selectedKey;
        const hovered = marker.key === hoverKey;
        const styles = severityStyles[marker.severity];
        const labelBelow = box.y < page.height * 0.1;
        const labelRight = box.x > page.width * 0.55;
        return (
          <button
            key={marker.key}
            type="button"
            aria-label={marker.title}
            aria-pressed={selected}
            className={cn(
              'absolute cursor-pointer rounded-[2px] transition-[opacity,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected ? cn('border-[3px]', styles.boxSelected) : cn('border-2', styles.box),
              box.offPage && 'border-dashed',
              selectedKey && !selected && !hovered && 'opacity-50',
              hovered && !selected && styles.boxSelected
            )}
            style={{ ...style(box, MARKER_OUTSET_PX), zIndex: selected ? 30 : hovered ? 20 : 10 }}
            onMouseEnter={() => onHover?.(marker.key)}
            onMouseLeave={() => onHover?.(null)}
            onClick={() => onSelect?.(marker.key)}
          >
            {(selected || box.offPage) && (
              <span
                className={cn(
                  'pointer-events-none absolute flex max-w-[20rem] items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight shadow',
                  styles.badge,
                  labelRight ? 'right-[-3px]' : 'left-[-3px]',
                  labelBelow ? 'top-[calc(100%+4px)]' : 'bottom-[calc(100%+4px)]',
                  !selected && 'opacity-90'
                )}
              >
                {selected && selectedLabel ? <span className="truncate">{selectedLabel}</span> : null}
                {box.offPage && <span>{selected && selectedLabel ? '· off page' : 'Off page'}</span>}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default PageCanvas;

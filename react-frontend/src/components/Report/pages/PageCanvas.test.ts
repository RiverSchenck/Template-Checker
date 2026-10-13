import type { CheckResult, Page } from '../../../types';
import flyer from '../../../fixtures/flyer-sales.json';
import { placeOnPage } from './PageCanvas';

const page: Page = { id: 'p1', name: '1', index: 1, spread_id: 's1', width: 600, height: 400, preview: null, frames: [] };
const at = (x: number, y: number, width: number, height: number) => ({ page_id: 'p1', kind: 'TextFrame', x, y, width, height });

describe('placeOnPage', () => {
  it('keeps a frame on the page where it is', () => {
    expect(placeOnPage(at(10, 20, 100, 50), page)).toEqual({ x: 10, y: 20, width: 100, height: 50, offPage: false });
  });

  it('clips a frame that runs off the page', () => {
    expect(placeOnPage(at(500, 350, 150, 100), page)).toEqual({ x: 500, y: 350, width: 100, height: 50, offPage: false });
  });

  it('pins a frame on the pasteboard to the nearest page edge, as a small marker', () => {
    expect(placeOnPage(at(700, 100, 40, 40), page)).toEqual({ x: 588, y: 114, width: 12, height: 12, offPage: true });
  });

  it('grows a tiny frame so it can be seen and clicked', () => {
    expect(placeOnPage(at(100, 100, 2, 2), page)).toMatchObject({ x: 95, y: 95, width: 12, height: 12 });
  });

  it('places every issue of a real result inside its page', () => {
    const { results } = flyer as unknown as CheckResult;
    const pages = new Map(results.pages.map((p) => [p.id, p]));
    const placed = results.issues.flatMap(({ location: { bounds } }) => (bounds ? [placeOnPage(bounds, pages.get(bounds.page_id)!)] : []));
    expect(placed.length).toBeGreaterThan(0);
    placed.forEach((box) => {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
    });
  });
});

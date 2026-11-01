import type { Box, Point } from "./geometry";

type Item = { id: string; width: number; height: number };

// What the layout needs to know about the wall, in wall pixels. The art hangs centered above the
// hang-above line: the top of furniture against the wall, or a line placed where furniture would be.
export type HangAbove = { left: number; right: number; top: number };
export type WallSpace = { surface: Box; hangAbove: HangAbove; pxPerCm: number };

const ABOVE_LINE_CM = 20;
const BELOW_CEILING_CM = 15;

const pick = <T>(options: readonly T[]) => options[Math.floor(Math.random() * options.length)];

function shuffle<T>(items: T[]) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Tallest piece in the middle, the rest alternating outwards.
function tallestInMiddle(row: Item[]) {
  const sorted = [...row].sort((a, b) => b.height - a.height);
  const result: Item[] = [];
  sorted.forEach((item, i) => (i % 2 === 0 ? result.push(item) : result.unshift(item)));
  return result;
}

// Two or three rows of pieces with an even gap and a shared vertical alignment per row: a wide, low cluster
// centered above the hang-above line that never drops below it, reaches the ceiling or leaves the wall.
// Positions are top-left corners in wall pixels.
export function randomLayout(items: Item[], { surface, hangAbove, pxPerCm }: WallSpace): Record<string, Point> {
  if (items.length === 0) return {};
  const gap = (5 + Math.random() * 3) * pxPerCm;
  const align = pick(["center", "top", "bottom"] as const);

  const top = surface.top + BELOW_CEILING_CM * pxPerCm;
  const bottom = Math.min(surface.bottom, hangAbove.top) - ABOVE_LINE_CM * pxPerCm;
  const availableHeight = bottom - top;
  const centerX = (hangAbove.left + hangAbove.right) / 2;
  const surfaceWidth = surface.right - surface.left;

  const rowWidth = (row: Item[]) => row.reduce((sum, item) => sum + item.width, 0) + gap * Math.max(0, row.length - 1);
  const rowHeight = (row: Item[]) => Math.max(...row.map((item) => item.height));
  const clusterHeight = (rows: Item[][]) => rows.reduce((sum, row) => sum + rowHeight(row), 0) + gap * (rows.length - 1);

  function balancedRows(count: number) {
    const rows = Array.from({ length: count }, (): Item[] => []);
    for (const item of shuffle(items)) rows.reduce((min, row) => (rowWidth(row) < rowWidth(min) ? row : min)).push(item);
    return rows.filter((row) => row.length > 0);
  }

  const arrangements = Array.from({ length: items.length }, (_, i) => balancedRows(i + 1));
  const widthOverflow = (rows: Item[][]) => Math.max(...rows.map(rowWidth)) / surfaceWidth - 1;
  const heightOverflow = (rows: Item[][]) => clusterHeight(rows) / Math.max(availableHeight, 1) - 1;
  // Pick between the two fewest row counts (from two rows up) that fit on the wall,
  // or the closest fit when none do.
  const fitting = arrangements.filter(
    (rows) => rows.length >= Math.min(2, items.length) && widthOverflow(rows) <= 0 && heightOverflow(rows) <= 0,
  );
  const misfit = (rows: Item[][]) => Math.max(0, widthOverflow(rows)) + Math.max(0, heightOverflow(rows));
  const chosen =
    fitting.length > 0
      ? pick(fitting.slice(0, 2))
      : arrangements.reduce((best, rows) => (misfit(rows) < misfit(best) ? rows : best));
  const rows = chosen.map((row) => (Math.random() < 0.5 ? tallestInMiddle(row) : shuffle(row)));

  const height = clusterHeight(rows);
  // Never below the line; when nothing fits, the cluster runs past the top instead.
  let y = bottom - height;
  const width = Math.max(...rows.map(rowWidth));
  // Shift sideways to stay within the wall's edges when the line sits off-center.
  const clusterCenter = Math.min(Math.max(centerX, surface.left + width / 2), surface.right - width / 2);

  const positions: Record<string, Point> = {};
  for (const row of rows) {
    const h = rowHeight(row);
    // Even out slightly shorter rows towards the widest one, but keep gaps close to even.
    const itemsWidth = row.reduce((sum, item) => sum + item.width, 0);
    const spreadGap = row.length > 1 ? (width - itemsWidth) / (row.length - 1) : gap;
    const rowGap = Math.min(spreadGap, gap * 1.5);
    let x = clusterCenter - (itemsWidth + rowGap * (row.length - 1)) / 2;
    for (const item of row) {
      const offset = { top: 0, center: (h - item.height) / 2, bottom: h - item.height }[align];
      positions[item.id] = { x, y: y + offset };
      x += item.width + rowGap;
    }
    y += h + gap;
  }
  return positions;
}

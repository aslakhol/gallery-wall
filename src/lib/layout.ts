import type { Box, Point } from "./geometry";

type Item = { id: string; width: number; height: number };

// What the layout needs to know about the wall, in wall pixels. The art hangs centered above the
// hang-above line: the top of furniture against the wall, or a line placed where furniture would be.
export type HangAbove = { left: number; right: number; top: number };
export type WallSpace = { surface: Box; hangAbove: HangAbove; pxPerCm: number };

const ABOVE_LINE_CM = 20;
const BELOW_CEILING_CM = 15;

// Where art may hang: below the ceiling and clear above the hang-above line, within the wall's edges.
function hangingArea({ surface, hangAbove, pxPerCm }: WallSpace): Box {
  return {
    left: surface.left,
    right: surface.right,
    top: surface.top + BELOW_CEILING_CM * pxPerCm,
    bottom: Math.min(surface.bottom, hangAbove.top) - ABOVE_LINE_CM * pxPerCm,
  };
}

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

// One to three rows of pieces with an even gap and a shared vertical alignment per row: a wide, low cluster
// centered above the hang-above line that never drops below it, reaches the ceiling or leaves the wall.
// Positions are top-left corners in wall pixels.
function randomLayout(items: Item[], wall: WallSpace): Record<string, Point> {
  if (items.length === 0) return {};
  const { surface, hangAbove, pxPerCm } = wall;
  const gap = (5 + Math.random() * 3) * pxPerCm;
  const align = pick(["center", "top", "bottom"] as const);

  const { top, bottom } = hangingArea(wall);
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
  // Pick between the three fewest row counts that fit on the wall, so a single wide row is one of the options,
  // or the closest fit when none do.
  const fitting = arrangements.filter((rows) => widthOverflow(rows) <= 0 && heightOverflow(rows) <= 0);
  const misfit = (rows: Item[][]) => Math.max(0, widthOverflow(rows)) + Math.max(0, heightOverflow(rows));
  const chosen =
    fitting.length > 0
      ? pick(fitting.slice(0, 3))
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

const LOCKED_BLOCK = "locked";
const ATTEMPTS = 30;

// Like randomLayout, but around locked pieces that stay where they are. The locked pieces join the arrangement
// as one block, and the arrangement moves so the block lands back in place. Of several tries, the one that
// strays least outside the hanging area wins.
export function layoutAround(items: Item[], wall: WallSpace, locked: Box[]): Record<string, Point> {
  if (locked.length === 0) return randomLayout(items, wall);
  if (items.length === 0) return {};
  const block = {
    left: Math.min(...locked.map((box) => box.left)),
    top: Math.min(...locked.map((box) => box.top)),
    right: Math.max(...locked.map((box) => box.right)),
    bottom: Math.max(...locked.map((box) => box.bottom)),
  };
  const blockItem = { id: LOCKED_BLOCK, width: block.right - block.left, height: block.bottom - block.top };
  const area = hangingArea(wall);

  const overflow = (positions: Record<string, Point>) =>
    items.reduce((sum, { id, width, height }) => {
      const { x, y } = positions[id];
      const outside = [area.left - x, x + width - area.right, area.top - y, y + height - area.bottom];
      return sum + outside.reduce((total, distance) => total + Math.max(0, distance), 0);
    }, 0);

  const attempts = Array.from({ length: ATTEMPTS }, () => {
    const positions = randomLayout([...items, blockItem], wall);
    const dx = block.left - positions[LOCKED_BLOCK].x;
    const dy = block.top - positions[LOCKED_BLOCK].y;
    return Object.fromEntries(items.map(({ id }) => [id, { x: positions[id].x + dx, y: positions[id].y + dy }]));
  });
  return attempts.reduce((best, positions) => (overflow(positions) < overflow(best) ? positions : best));
}

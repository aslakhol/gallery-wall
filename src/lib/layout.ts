import type { Box, Point } from "./geometry";

type Item = { id: string; width: number; height: number };

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

// Rows of pieces with an even gap, a shared vertical alignment per row, centered in the hang area.
// Positions are top-left corners in wall pixels.
export function randomLayout(items: Item[], area: Box, pxPerCm: number): Record<string, Point> {
  if (items.length === 0) return {};
  const gap = (5 + Math.random() * 3) * pxPerCm;
  const align = pick(["center", "top", "bottom"] as const);
  const areaWidth = area.right - area.left;

  const rowWidth = (row: Item[]) => row.reduce((sum, item) => sum + item.width, 0) + gap * Math.max(0, row.length - 1);

  // Fewest rows that fit the area's width, sometimes one more for a taller cluster.
  const fits = (count: number) => {
    const rows = Array.from({ length: count }, (): Item[] => []);
    for (const item of shuffle(items)) rows.reduce((min, row) => (rowWidth(row) < rowWidth(min) ? row : min)).push(item);
    return rows;
  };
  let rowCount = 1;
  while (rowCount < items.length && Math.max(...fits(rowCount).map(rowWidth)) > areaWidth) rowCount++;
  if (items.length > 3 && Math.random() < 0.5) rowCount = Math.min(items.length, rowCount + 1);
  const rows = fits(rowCount)
    .filter((row) => row.length > 0)
    .map((row) => (Math.random() < 0.5 ? tallestInMiddle(row) : shuffle(row)));

  const rowHeights = rows.map((row) => Math.max(...row.map((item) => item.height)));
  const totalHeight = rowHeights.reduce((a, b) => a + b, 0) + gap * (rows.length - 1);
  const centerX = (area.left + area.right) / 2;
  // Sit near the bottom of the hang area, but stay inside it when the cluster is tall.
  const top = Math.max(area.top, area.bottom - 20 * pxPerCm - totalHeight);

  const positions: Record<string, Point> = {};
  let y = top;
  rows.forEach((row, i) => {
    let x = centerX - rowWidth(row) / 2;
    for (const item of row) {
      const offset = { top: 0, center: (rowHeights[i] - item.height) / 2, bottom: rowHeights[i] - item.height }[align];
      positions[item.id] = { x, y: y + offset };
      x += item.width + gap;
    }
    y += rowHeights[i] + gap;
  });
  return positions;
}

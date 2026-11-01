import type { Box, Point } from "./geometry";

type Item = { id: string; width: number; height: number };

// What the layout needs to know about the wall, in wall pixels.
export type WallSpace = { surface: Box; furniture: Box | null; pxPerCm: number };

const ABOVE_FURNITURE_CM = 20;
const BELOW_CEILING_CM = 15;
// Without furniture the art is centered at eye height, measured from the bottom of the surface (the floor).
const EYE_HEIGHT_CM = 145;

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

// Rows of pieces with an even gap and a shared vertical alignment per row.
// Above furniture, the cluster aims for roughly the furniture's width, centered over it, and never drops into it.
// Positions are top-left corners in wall pixels.
export function randomLayout(items: Item[], { surface, furniture, pxPerCm }: WallSpace): Record<string, Point> {
  if (items.length === 0) return {};
  const gap = (5 + Math.random() * 3) * pxPerCm;
  const align = pick(["center", "top", "bottom"] as const);

  const top = surface.top + BELOW_CEILING_CM * pxPerCm;
  const furnitureLimit = furniture && Math.min(surface.bottom, furniture.top) - ABOVE_FURNITURE_CM * pxPerCm;
  const eyeLevel = surface.bottom - EYE_HEIGHT_CM * pxPerCm;
  const availableHeight = furnitureLimit ? furnitureLimit - top : 2 * (eyeLevel - top);
  const centerX = furniture ? (furniture.left + furniture.right) / 2 : (surface.left + surface.right) / 2;
  const baseWidth = furniture ? furniture.right - furniture.left : (surface.right - surface.left) * 0.6;
  const targetWidth = baseWidth * (0.75 + Math.random() * 0.25);

  const rowWidth = (row: Item[]) => row.reduce((sum, item) => sum + item.width, 0) + gap * Math.max(0, row.length - 1);
  const rowHeight = (row: Item[]) => Math.max(...row.map((item) => item.height));
  const clusterHeight = (rows: Item[][]) => rows.reduce((sum, row) => sum + rowHeight(row), 0) + gap * (rows.length - 1);

  function balancedRows(count: number) {
    const rows = Array.from({ length: count }, (): Item[] => []);
    for (const item of shuffle(items)) rows.reduce((min, row) => (rowWidth(row) < rowWidth(min) ? row : min)).push(item);
    return rows.filter((row) => row.length > 0);
  }

  // Closest to the target width wins; running out of wall is much worse than missing the width.
  const surfaceWidth = surface.right - surface.left;
  const candidates = Array.from({ length: items.length }, (_, i) => balancedRows(i + 1))
    .map((rows) => {
      const width = Math.max(...rows.map(rowWidth));
      const widthMiss = Math.abs(width - targetWidth) / targetWidth;
      const widthOverflow = Math.max(0, width - surfaceWidth) / surfaceWidth;
      const heightOverflow = Math.max(0, clusterHeight(rows) - availableHeight) / availableHeight;
      return { rows, score: widthMiss + (widthOverflow + heightOverflow) * 10 };
    })
    .sort((a, b) => a.score - b.score);
  // Some variety: sometimes take the runner-up when it is nearly as good.
  const [best, runnerUp] = candidates;
  const chosen = runnerUp && runnerUp.score < best.score + 0.15 && Math.random() < 0.4 ? runnerUp : best;
  const rows = chosen.rows.map((row) => (Math.random() < 0.5 ? tallestInMiddle(row) : shuffle(row)));

  const height = clusterHeight(rows);
  let y = Math.max(top, furnitureLimit ? furnitureLimit - height : eyeLevel - height / 2);
  // Shift sideways to stay within the wall's edges when the furniture sits off-center.
  const halfWidth = Math.max(...rows.map(rowWidth)) / 2;
  const clusterCenter = Math.min(Math.max(centerX, surface.left + halfWidth), surface.right - halfWidth);

  const positions: Record<string, Point> = {};
  for (const row of rows) {
    const h = rowHeight(row);
    let x = clusterCenter - rowWidth(row) / 2;
    for (const item of row) {
      const offset = { top: 0, center: (h - item.height) / 2, bottom: h - item.height }[align];
      positions[item.id] = { x, y: y + offset };
      x += item.width + gap;
    }
    y += h + gap;
  }
  return positions;
}

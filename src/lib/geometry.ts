export type Point = { x: number; y: number };
export type Quad = { topLeft: Point; topRight: Point; bottomRight: Point; bottomLeft: Point };
export type Box = { left: number; top: number; right: number; bottom: number };

// The analysis model returns coordinates normalized to 0–1000.
export const toPixels = ({ x, y }: Point, width: number, height: number): Point => ({
  x: (x / 1000) * width,
  y: (y / 1000) * height,
});

export const boxToPixels = (box: Box, width: number, height: number): Box => ({
  left: (box.left / 1000) * width,
  right: (box.right / 1000) * width,
  top: (box.top / 1000) * height,
  bottom: (box.bottom / 1000) * height,
});

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// Solve the projective transform that maps the unit square onto the quad.
function unitSquareTo(quad: Quad) {
  const corners = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
  const unit = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const A: number[][] = [];
  const b: number[] = [];
  unit.forEach(([x, y], i) => {
    const { x: u, y: v } = corners[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  });
  for (let c = 0; c < 8; c++) {
    let pivot = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[pivot][c])) pivot = r;
    [A[c], A[pivot]] = [A[pivot], A[c]];
    [b[c], b[pivot]] = [b[pivot], b[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const h = b.map((v, i) => v / A[i][i]);
  return (x: number, y: number): Point => {
    const d = h[6] * x + h[7] * y + 1;
    return { x: (h[0] * x + h[1] * y + h[2]) / d, y: (h[3] * x + h[4] * y + h[5]) / d };
  };
}

// Cut a quad out of the photo and straighten it into a rectangle.
export function unwarp(photo: ImageData, quad: Quad) {
  const width = Math.round((distance(quad.topLeft, quad.topRight) + distance(quad.bottomLeft, quad.bottomRight)) / 2);
  const height = Math.round((distance(quad.topLeft, quad.bottomLeft) + distance(quad.topRight, quad.bottomRight)) / 2);
  const map = unitSquareTo(quad);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const out = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = map((x + 0.5) / width, (y + 0.5) / height);
      const sx = Math.min(photo.width - 1, Math.max(0, Math.round(p.x)));
      const sy = Math.min(photo.height - 1, Math.max(0, Math.round(p.y)));
      const si = (sy * photo.width + sx) * 4;
      const oi = (y * width + x) * 4;
      out.data.set(photo.data.subarray(si, si + 4), oi);
    }
  }
  ctx.putImageData(out, 0, 0);
  return { url: canvas.toDataURL("image/jpeg", 0.9), aspect: width / height };
}

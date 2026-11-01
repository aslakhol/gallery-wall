"use client";

import type { WallSpace } from "@/lib/layout";
import { trackPointer } from "./track-pointer";

const HANDLE = 18;

// The wall surface and hang-above line the layout works from, with handles to correct them
// and cm fields to set the scale from a known measurement.
export function WallGuides({
  wall,
  zoom,
  onChange,
}: {
  wall: WallSpace;
  zoom: number;
  onChange: (wall: WallSpace) => void;
}) {
  const { surface, hangAbove, pxPerCm } = wall;
  const px = (n: number) => n / zoom;

  const handle = (key: string, x: number, y: number, onMove: (dx: number, dy: number) => void) => (
    <div
      key={key}
      className="pointer-events-auto absolute cursor-move touch-none rounded-full border-white bg-fuchsia-500"
      style={{ left: x - px(HANDLE / 2), top: y - px(HANDLE / 2), width: px(HANDLE), height: px(HANDLE), borderWidth: px(2) }}
      onPointerDown={(e) => trackPointer(e, zoom, onMove)}
    />
  );

  // Setting a real length rescales the wall; everything measured in cm follows.
  const setLength = (lengthPx: number) => (cm: number) => onChange({ ...wall, pxPerCm: lengthPx / cm });

  const corners = (["left", "right"] as const).flatMap((h) =>
    (["top", "bottom"] as const).map((v) =>
      handle(`${h}-${v}`, surface[h], surface[v], (dx, dy) =>
        onChange({ ...wall, surface: { ...surface, [h]: surface[h] + dx, [v]: surface[v] + dy } }),
      ),
    ),
  );

  // Above every piece, but only the handles and fields take pointer input.
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 10_000 }}>
      <div
        className="absolute border-dashed border-fuchsia-500"
        style={{
          left: surface.left,
          top: surface.top,
          width: surface.right - surface.left,
          height: surface.bottom - surface.top,
          borderWidth: px(3),
        }}
      />
      <CmField
        x={(surface.left + surface.right) / 2}
        y={surface.top}
        zoom={zoom}
        cm={(surface.right - surface.left) / pxPerCm}
        onCommit={setLength(surface.right - surface.left)}
      />
      <CmField
        x={surface.left}
        y={(surface.top + surface.bottom) / 2}
        zoom={zoom}
        cm={(surface.bottom - surface.top) / pxPerCm}
        onCommit={setLength(surface.bottom - surface.top)}
      />
      {corners}
      <div
        className="absolute bg-amber-500"
        style={{ left: hangAbove.left, top: hangAbove.top, width: hangAbove.right - hangAbove.left, height: px(4) }}
      />
      <CmField
        label="Hang above"
        x={(hangAbove.left + hangAbove.right) / 2}
        y={hangAbove.top + px(24)}
        zoom={zoom}
        cm={(hangAbove.right - hangAbove.left) / pxPerCm}
        onCommit={setLength(hangAbove.right - hangAbove.left)}
      />
      {(["left", "right"] as const).map((end) =>
        handle(`hang-above-${end}`, hangAbove[end], hangAbove.top, (dx, dy) =>
          onChange({ ...wall, hangAbove: { ...hangAbove, [end]: hangAbove[end] + dx, top: hangAbove.top + dy } }),
        ),
      )}
    </div>
  );
}

// An editable cm length centered on (x, y), sized to stay readable at any zoom.
function CmField({
  label,
  x,
  y,
  zoom,
  cm,
  onCommit,
}: {
  label?: string;
  x: number;
  y: number;
  zoom: number;
  cm: number;
  onCommit: (cm: number) => void;
}) {
  const rounded = Math.round(cm);
  const commit = (input: HTMLInputElement) => {
    const value = Number(input.value);
    if (value > 0 && value !== rounded) onCommit(value);
    else input.value = String(rounded);
  };
  return (
    <label
      className="pointer-events-auto absolute flex items-center rounded bg-white/90 font-medium text-stone-900 shadow"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        fontSize: 13 / zoom,
        padding: `${2 / zoom}px ${6 / zoom}px`,
        gap: 2 / zoom,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {label && <span className="mr-1 text-stone-500">{label}</span>}
      <input
        key={rounded}
        type="number"
        min={1}
        defaultValue={rounded}
        className="bg-transparent text-right outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        style={{ width: `${String(rounded).length + 1}ch` }}
        onBlur={(e) => commit(e.currentTarget)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
      cm
    </label>
  );
}

"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { WallSpace } from "@/lib/layout";
import { trackPointer } from "./track-pointer";
import { FramePosition, WallGuides } from "./wall-guides";

export type StageItem = {
  id: string;
  url: string;
  label: string;
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
  locked: boolean;
};

type Change = { x?: number; y?: number; scale?: number };

// Shows the wall photo at its natural pixel size, scaled to fit, with draggable and resizable pieces on top.
// Locked pieces stay put until unlocked.
// With measurements on, it also shows the wall guides, every piece's size in cm and where the selected piece goes.
export function WallStage({
  image,
  width,
  height,
  items,
  onChange,
  onToggleLock,
  wall,
  showMeasurements,
  onWallChange,
}: {
  image: string;
  width: number;
  height: number;
  items: StageItem[];
  onChange: (id: string, change: Change) => void;
  onToggleLock: (id: string) => void;
  wall: WallSpace;
  showMeasurements: boolean;
  onWallChange: (wall: WallSpace) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0);
  const [selectedId, setSelectedId] = useState<string>();
  const [stackOrder, setStackOrder] = useState<string[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() =>
      setZoom(Math.min(container.clientWidth / width, container.clientHeight / height)),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [width, height]);

  const selected = items.find((item) => item.id === selectedId);

  function startDrag(event: ReactPointerEvent, item: StageItem) {
    setSelectedId(item.id);
    setStackOrder((order) => [...order.filter((id) => id !== item.id), item.id]);
    if (item.locked) event.stopPropagation();
    else trackPointer(event, zoom, (dx, dy) => onChange(item.id, { x: item.x + dx, y: item.y + dy }));
  }

  function startResize(event: ReactPointerEvent, item: StageItem) {
    trackPointer(event, zoom, (dx) => onChange(item.id, { scale: Math.max(0.1, item.scale * (1 + dx / item.width)) }));
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden" onPointerDown={() => setSelectedId(undefined)}>
      {zoom > 0 && (
        <div
          className="absolute left-1/2 top-1/2 origin-center"
          style={{ width, height, transform: `translate(-50%, -50%) scale(${zoom})` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
          <img src={image} alt="" className="absolute inset-0 h-full w-full select-none" draggable={false} />
          {items.map((item) => (
            <div
              key={item.id}
              className={`absolute touch-none ${item.locked ? "" : "cursor-grab active:cursor-grabbing"}`}
              style={{
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.height,
                zIndex: stackOrder.indexOf(item.id) + 1,
              }}
              onPointerDown={(e) => startDrag(e, item)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
              <img
                src={item.url}
                alt={item.label}
                draggable={false}
                className="h-full w-full select-none shadow-[2px_6px_12px_rgba(0,0,0,0.35)]"
                style={{ outline: selectedId === item.id ? `${3 / zoom}px solid #3b82f6` : undefined }}
              />
              {showMeasurements && (
                <span
                  className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-white/90 font-medium text-stone-900 shadow"
                  style={{ bottom: 6 / zoom, fontSize: 12 / zoom, padding: `${1 / zoom}px ${5 / zoom}px` }}
                >
                  {Math.round(item.width / wall.pxPerCm)} × {Math.round(item.height / wall.pxPerCm)} cm
                </span>
              )}
              {(selectedId === item.id || item.locked) && (
                <button
                  aria-label={item.locked ? "Unlock" : "Lock"}
                  aria-pressed={item.locked}
                  className={`absolute flex items-center justify-center rounded-full border-white shadow ${
                    item.locked ? "bg-stone-900 text-white" : "bg-white text-stone-900"
                  }`}
                  style={{ width: 26 / zoom, height: 26 / zoom, left: 6 / zoom, top: 6 / zoom, borderWidth: 2 / zoom }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onToggleLock(item.id)}
                >
                  <LockIcon open={!item.locked} style={{ width: 14 / zoom, height: 14 / zoom }} />
                </button>
              )}
              {selectedId === item.id && !item.locked && (
                <div
                  className="absolute rounded-full border-white bg-blue-500 cursor-nwse-resize touch-none"
                  style={{
                    width: 22 / zoom,
                    height: 22 / zoom,
                    right: -11 / zoom,
                    bottom: -11 / zoom,
                    borderWidth: 2 / zoom,
                  }}
                  onPointerDown={(e) => startResize(e, item)}
                />
              )}
            </div>
          ))}
          {showMeasurements && <WallGuides wall={wall} zoom={zoom} onChange={onWallChange} />}
          {showMeasurements && selected && <FramePosition frame={selected} wall={wall} zoom={zoom} />}
        </div>
      )}
    </div>
  );
}

function LockIcon({ open, style }: { open: boolean; style: CSSProperties }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d={open ? "M8 11V7a4 4 0 0 1 7.5-2" : "M8 11V7a4 4 0 0 1 8 0v4"} />
    </svg>
  );
}

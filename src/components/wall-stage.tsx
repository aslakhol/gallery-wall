"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { WallSpace } from "@/lib/layout";
import { trackPointer } from "./track-pointer";
import { WallGuides } from "./wall-guides";

export type StageItem = {
  id: string;
  url: string;
  label: string;
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
};

type Change = { x?: number; y?: number; scale?: number };

// Shows the wall photo at its natural pixel size, scaled to fit, with draggable and resizable pieces on top.
// With measurements on, it also shows the wall guides and every piece's size in cm.
export function WallStage({
  image,
  width,
  height,
  items,
  onChange,
  wall,
  showMeasurements,
  onWallChange,
}: {
  image: string;
  width: number;
  height: number;
  items: StageItem[];
  onChange: (id: string, change: Change) => void;
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

  function startDrag(event: ReactPointerEvent, item: StageItem) {
    setSelectedId(item.id);
    setStackOrder((order) => [...order.filter((id) => id !== item.id), item.id]);
    trackPointer(event, zoom, (dx, dy) => onChange(item.id, { x: item.x + dx, y: item.y + dy }));
  }

  function startResize(event: ReactPointerEvent, item: StageItem) {
    trackPointer(event, zoom, (dx) => onChange(item.id, { scale: Math.max(0.1, item.scale * (1 + dx / item.width)) }));
  }

  // Scroll over a piece to resize it around its center.
  function wheelResize(event: React.WheelEvent, item: StageItem) {
    const factor = event.deltaY < 0 ? 1.04 : 1 / 1.04;
    onChange(item.id, {
      scale: item.scale * factor,
      x: item.x - (item.width * (factor - 1)) / 2,
      y: item.y - (item.height * (factor - 1)) / 2,
    });
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
              className="absolute touch-none cursor-grab active:cursor-grabbing"
              style={{
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.height,
                zIndex: stackOrder.indexOf(item.id) + 1,
              }}
              onPointerDown={(e) => startDrag(e, item)}
              onWheel={(e) => wheelResize(e, item)}
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
              {selectedId === item.id && (
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
        </div>
      )}
    </div>
  );
}

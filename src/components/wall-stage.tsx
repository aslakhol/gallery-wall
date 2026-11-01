"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { WallSpace } from "@/lib/layout";

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
export function WallStage({
  image,
  width,
  height,
  items,
  onChange,
  guides,
}: {
  image: string;
  width: number;
  height: number;
  items: StageItem[];
  onChange: (id: string, change: Change) => void;
  // Outlines what the analysis thinks the wall and furniture are, for debugging layouts.
  guides?: WallSpace;
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

  // Follow the pointer until release, reporting the movement in wall pixels.
  function track(event: ReactPointerEvent, onMove: (dx: number, dy: number) => void) {
    event.stopPropagation();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const start = { x: event.clientX, y: event.clientY };
    const move = (e: PointerEvent) => onMove((e.clientX - start.x) / zoom, (e.clientY - start.y) / zoom);
    const up = () => {
      target.removeEventListener("pointermove", move as EventListener);
      target.removeEventListener("pointerup", up);
    };
    target.addEventListener("pointermove", move as EventListener);
    target.addEventListener("pointerup", up);
  }

  function startDrag(event: ReactPointerEvent, item: StageItem) {
    setSelectedId(item.id);
    setStackOrder((order) => [...order.filter((id) => id !== item.id), item.id]);
    track(event, (dx, dy) => onChange(item.id, { x: item.x + dx, y: item.y + dy }));
  }

  function startResize(event: ReactPointerEvent, item: StageItem) {
    track(event, (dx) => onChange(item.id, { scale: Math.max(0.1, item.scale * (1 + dx / item.width)) }));
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
          {guides && (
            <>
              <div
                className="absolute border-dashed border-fuchsia-500"
                style={{
                  left: guides.surface.left,
                  top: guides.surface.top,
                  width: guides.surface.right - guides.surface.left,
                  height: guides.surface.bottom - guides.surface.top,
                  borderWidth: 3 / zoom,
                }}
              />
              {guides.furniture && (
                <div
                  className="absolute bg-amber-500"
                  style={{
                    left: guides.furniture.left,
                    top: guides.furniture.top,
                    width: guides.furniture.right - guides.furniture.left,
                    height: 4 / zoom,
                  }}
                />
              )}
            </>
          )}
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
        </div>
      )}
    </div>
  );
}

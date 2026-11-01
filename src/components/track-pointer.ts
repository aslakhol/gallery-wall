import type { PointerEvent as ReactPointerEvent } from "react";

// Follow the pointer until release, reporting the movement since the press in wall pixels.
export function trackPointer(event: ReactPointerEvent, zoom: number, onMove: (dx: number, dy: number) => void) {
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

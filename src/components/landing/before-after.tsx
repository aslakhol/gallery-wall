"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef, useState } from "react";

const SWEEP_FROM = 85;
const SWEEP_TO = 30;
const SWEEP_MS = 1600;

// Drag across to compare the photo as taken with the planned wall. Both images share the same framing.
// On load the divider sweeps across once, ending with most of the planned wall in view.
export function BeforeAfter({ before, after }: { before: StaticImageData; after: StaticImageData }) {
  const [split, setSplit] = useState(SWEEP_FROM);
  const touched = useRef(false);

  useEffect(() => {
    let frame = 0;
    const start = performance.now() + 400;
    const step = (now: number) => {
      if (touched.current) return;
      const t = Math.min(1, Math.max(0, (now - start) / SWEEP_MS));
      const eased = 1 - (1 - t) ** 3;
      setSplit(SWEEP_FROM + (SWEEP_TO - SWEEP_FROM) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-[0_30px_80px_-20px_rgba(41,37,36,0.45)] ring-1 ring-stone-900/10 select-none"
      style={{ aspectRatio: `${before.width} / ${before.height}` }}
    >
      <Image src={before} alt="A room with framed art leaning against the wall" fill priority sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
        <Image src={after} alt="The same room with the art arranged on the wall" fill priority sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
      </div>

      <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-stone-900/70 px-3 py-1 text-xs font-medium text-white backdrop-blur">
        Your photo
      </span>
      <span className="pointer-events-none absolute right-4 top-4 rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-stone-900 backdrop-blur">
        Your wall
      </span>

      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${split}%` }}>
        <div className="absolute inset-y-0 -translate-x-1/2 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,0.4)]" />
        <div className="absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-stone-900" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
          </svg>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={0.1}
        value={split}
        onChange={(event) => {
          touched.current = true;
          setSplit(Number(event.target.value));
        }}
        aria-label="Compare your photo with your planned wall"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

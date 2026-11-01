"use client";

import { useMemo, useRef, useState } from "react";
import type { PhotoAnalysis } from "@/lib/analyze-photo";
import { boxToPixels, toPixels, unwarp, type Box } from "@/lib/geometry";
import { JOB_HEADER } from "@/lib/job";
import { randomLayout } from "@/lib/layout";
import { WallStage, type StageItem } from "./wall-stage";

type Photo = {
  id: string;
  url: string;
  width: number;
  height: number;
  analysis?: PhotoAnalysis;
  cleanUrl?: string;
  failed?: boolean;
};

type Piece = {
  id: string;
  label: string;
  url: string;
  aspect: number;
  longestCm: number;
  hidden: boolean;
};

type Placement = { x: number; y: number; scale: number };
type Layout = Record<string, Placement>;

type Wall = { photo: Photo; area: Box; pxPerCm: number };

const MAX_EDGE = 2048;

// Downscale before upload to stay well inside request size limits.
async function preparePhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode photo"))), "image/jpeg", 0.9),
  );
  return { blob, width: canvas.width, height: canvas.height, pixels: ctx.getImageData(0, 0, canvas.width, canvas.height) };
}

async function post(path: string, body: Blob, jobId: string) {
  const response = await fetch(path, { method: "POST", body, headers: { "Content-Type": body.type, [JOB_HEADER]: jobId } });
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
  return response;
}

function toWall(photo: Photo): Wall | undefined {
  const wall = photo.analysis?.wall;
  if (!wall) return undefined;
  const area = boxToPixels(wall.hangArea, photo.width, photo.height);
  return { photo, area, pxPerCm: (area.right - area.left) / wall.hangAreaWidthCm };
}

// Pieces keep the proportions seen in the photo; the estimated real size only sets how big they are.
function pieceSize(piece: Piece, wall: Wall, scale: number) {
  const longest = piece.longestCm * wall.pxPerCm * scale;
  return piece.aspect >= 1
    ? { width: longest, height: longest / piece.aspect }
    : { width: longest * piece.aspect, height: longest };
}

function shuffledLayout(pieces: Piece[], wall: Wall, current: Layout | undefined): Layout {
  const scaleOf = (piece: Piece) => current?.[piece.id]?.scale ?? 1;
  const positions = randomLayout(
    pieces.map((piece) => ({ id: piece.id, ...pieceSize(piece, wall, scaleOf(piece)) })),
    wall.area,
    wall.pxPerCm,
  );
  return Object.fromEntries(pieces.map((piece) => [piece.id, { ...positions[piece.id], scale: scaleOf(piece) }]));
}

export function Planner() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [layouts, setLayouts] = useState<Record<string, Layout>>({});
  const [chosenWallId, setChosenWallId] = useState<string>();
  // One job per planning session, started by the first upload; AI costs are reported per job.
  const jobIdRef = useRef<string>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  const updatePhoto = (id: string, patch: Partial<Photo>) =>
    setPhotos((all) => all.map((photo) => (photo.id === id ? { ...photo, ...patch } : photo)));

  async function addPhoto(file: File) {
    const id = crypto.randomUUID();
    const jobId = (jobIdRef.current ??= crypto.randomUUID());
    const { blob, width, height, pixels } = await preparePhoto(file);
    setPhotos((all) => [...all, { id, url: URL.createObjectURL(blob), width, height }]);

    const analyze = post("/api/analyze", blob, jobId)
      .then((response) => response.json() as Promise<PhotoAnalysis>)
      .then((analysis) => {
        updatePhoto(id, { analysis });
        const found = analysis.art.map((art): Piece => {
          const quad = {
            topLeft: toPixels(art.corners.topLeft, width, height),
            topRight: toPixels(art.corners.topRight, width, height),
            bottomRight: toPixels(art.corners.bottomRight, width, height),
            bottomLeft: toPixels(art.corners.bottomLeft, width, height),
          };
          return {
            id: crypto.randomUUID(),
            label: art.label,
            ...unwarp(pixels, quad),
            longestCm: Math.max(art.widthCm, art.heightCm),
            hidden: false,
          };
        });
        setPieces((all) => [...all, ...found]);
      });

    const clean = post("/api/clean", blob, jobId)
      .then((response) => response.blob())
      .then((cleaned) => updatePhoto(id, { cleanUrl: URL.createObjectURL(cleaned) }));

    await Promise.all([analyze, clean]).catch((error) => {
      console.error(error);
      updatePhoto(id, { failed: true });
    });
  }

  const walls = photos.flatMap((photo) => toWall(photo) ?? []);
  const activeWall =
    walls.find((wall) => wall.photo.id === chosenWallId) ?? walls.find((wall) => wall.photo.cleanUrl) ?? walls[0];
  const visiblePieces = pieces.filter((piece) => !piece.hidden);
  const storedLayout = activeWall && layouts[activeWall.photo.id];
  const needsLayout = !!activeWall && visiblePieces.some((piece) => !storedLayout?.[piece.id]);

  // New art (or a wall without a layout yet) gets a fresh arrangement until the user touches it.
  const layoutKey = needsLayout ? `${activeWall.photo.id}:${visiblePieces.map((piece) => piece.id).join()}` : "";
  const autoLayout = useMemo(
    () => (needsLayout ? shuffledLayout(visiblePieces, activeWall, storedLayout) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute only when the wall or the set of pieces changes
    [layoutKey],
  );
  const layout = autoLayout ?? storedLayout ?? {};

  function shuffle() {
    if (!activeWall) return;
    setLayouts((all) => ({ ...all, [activeWall.photo.id]: shuffledLayout(visiblePieces, activeWall, layout) }));
  }

  function changePlacement(id: string, change: Partial<Placement>) {
    if (!activeWall) return;
    setLayouts((all) => ({ ...all, [activeWall.photo.id]: { ...layout, [id]: { ...layout[id], ...change } } }));
  }

  const toggleHidden = (id: string) =>
    setPieces((all) => all.map((piece) => (piece.id === id ? { ...piece, hidden: !piece.hidden } : piece)));

  const stageItems: StageItem[] = activeWall
    ? visiblePieces.flatMap((piece) => {
        const placement = layout[piece.id];
        if (!placement) return [];
        return [{ ...piece, ...placement, ...pieceSize(piece, activeWall, placement.scale) }];
      })
    : [];

  const processing = photos.some((photo) => !photo.failed && (!photo.analysis || !photo.cleanUrl));

  const uploadInput = (
    <input
      ref={fileInput}
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={(event) => {
        for (const file of event.target.files ?? []) void addPhoto(file);
        event.target.value = "";
      }}
    />
  );

  if (photos.length === 0) {
    return (
      <main className="flex h-dvh items-center justify-center bg-stone-100">
        {uploadInput}
        <button
          className="rounded-full bg-stone-900 px-8 py-4 text-lg font-medium text-white hover:bg-stone-700"
          onClick={() => fileInput.current?.click()}
        >
          Upload photos
        </button>
      </main>
    );
  }

  return (
    <main className="flex h-dvh flex-col bg-stone-100">
      {uploadInput}
      <header className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-2">
        <div className="flex gap-2 overflow-x-auto">
          {photos.map((photo) => {
            const wall = walls.find((w) => w.photo.id === photo.id);
            const pending = !photo.failed && (!photo.analysis || (wall && !photo.cleanUrl));
            return (
              <button
                key={photo.id}
                disabled={!wall?.photo.cleanUrl}
                onClick={() => setChosenWallId(photo.id)}
                title={photo.failed ? "Failed" : wall ? "Wall" : pending ? undefined : "Art only"}
                className={`relative h-12 w-16 shrink-0 overflow-hidden rounded-md ring-2 ${
                  activeWall?.photo.id === photo.id ? "ring-blue-500" : "ring-transparent"
                } ${wall || pending ? "" : "opacity-40"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                <img src={photo.cleanUrl ?? photo.url} alt="" className="h-full w-full object-cover" />
                {pending && <Spinner className="absolute inset-0 m-auto h-5 w-5 text-white" />}
                {photo.failed && <span className="absolute inset-0 bg-red-500/50" />}
              </button>
            );
          })}
        </div>
        <button
          className="ml-auto shrink-0 rounded-full border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
          onClick={() => fileInput.current?.click()}
        >
          Add photos
        </button>
        <button
          className="shrink-0 rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-40"
          disabled={!activeWall?.photo.cleanUrl || visiblePieces.length === 0}
          onClick={shuffle}
        >
          Random
        </button>
      </header>

      <section className="relative min-h-0 flex-1">
        {activeWall?.photo.cleanUrl ? (
          <WallStage
            image={activeWall.photo.cleanUrl}
            width={activeWall.photo.width}
            height={activeWall.photo.height}
            items={stageItems}
            onChange={changePlacement}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-400">
            {processing ? <Spinner className="h-8 w-8" /> : "No wall found"}
          </div>
        )}
      </section>

      {pieces.length > 0 && (
        <footer className="flex gap-3 overflow-x-auto border-t border-stone-200 bg-white px-4 py-3">
          {pieces.map((piece) => (
            <button
              key={piece.id}
              title={piece.label}
              onClick={() => toggleHidden(piece.id)}
              className={`h-16 shrink-0 transition-opacity ${piece.hidden ? "opacity-30 grayscale" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
              <img src={piece.url} alt={piece.label} className="h-full w-auto rounded-sm shadow" />
            </button>
          ))}
        </footer>
      )}
    </main>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PhotoAnalysis } from "@/lib/analyze-photo";
import { boxToPixels, toPixels, unwarp } from "@/lib/geometry";
import { JOB_HEADER } from "@/lib/job";
import { randomLayout, type WallSpace } from "@/lib/layout";
import { WallStage, type StageItem } from "./wall-stage";

type Photo = {
  id: string;
  url: string;
  width: number;
  height: number;
  analysis?: PhotoAnalysis;
  // The analyzed wall in pixels, which the user can correct.
  wall?: WallSpace;
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
type SavedLayout = { id: string; layout: Layout; visibleIds: string[] };

type Wall = WallSpace & { photo: Photo };

const MAX_EDGE = 2048;

// Downscale before upload to stay well inside request size limits.
async function preparePhoto(file: Blob) {
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

// Finds the art and the wall in a photo, and produces the photo with the art removed.
type Processor = (photo: Blob) => { analysis: Promise<PhotoAnalysis>; cleanUrl: Promise<string> };

const viaApi =
  (jobId: string): Processor =>
  (photo) => ({
    analysis: post("/api/analyze", photo, jobId).then((response) => response.json() as Promise<PhotoAnalysis>),
    cleanUrl: post("/api/clean", photo, jobId)
      .then((response) => response.blob())
      .then((cleaned) => URL.createObjectURL(cleaned)),
  });

// A photo that has already been processed, for trying the planner without uploading anything.
// `hidden` lists the labels of art that starts in the tray, off the wall.
export type Example = { photo: string; cleanUrl: string; analysis: PhotoAnalysis; hidden: string[] };

function wallSpace(wall: NonNullable<PhotoAnalysis["wall"]>, width: number, height: number): WallSpace {
  const surface = boxToPixels(wall.surface, width, height);
  const hangAbove = {
    left: (wall.hangAbove.left / 1000) * width,
    right: (wall.hangAbove.right / 1000) * width,
    top: (wall.hangAbove.top / 1000) * height,
  };
  return { surface, hangAbove, pxPerCm: (surface.right - surface.left) / wall.surfaceWidthCm };
}

// Pieces keep the proportions seen in the photo; the estimated real size only sets how big they are.
function pieceSize(piece: Piece, wall: Wall, scale: number) {
  const longest = piece.longestCm * wall.pxPerCm * scale;
  return piece.aspect >= 1
    ? { width: longest, height: longest / piece.aspect }
    : { width: longest * piece.aspect, height: longest };
}

// Keep an arrangement's proportions when the wall's scale changes: pieces grow or shrink,
// and their positions scale around the bottom center of the cluster so it keeps its place above the hang-above line.
function rescaleLayout(layout: Layout, pieces: Piece[], from: Wall, ratio: number): Layout {
  const boxes = pieces.flatMap((piece) => {
    const placement = layout[piece.id];
    return placement ? [{ id: piece.id, placement, ...pieceSize(piece, from, placement.scale) }] : [];
  });
  if (boxes.length === 0) return layout;
  const anchorX = boxes.reduce((sum, b) => sum + b.placement.x + b.width / 2, 0) / boxes.length;
  const anchorY = Math.max(...boxes.map((b) => b.placement.y + b.height));
  return {
    ...layout,
    ...Object.fromEntries(
      boxes.map(({ id, placement, width, height }) => {
        const centerX = anchorX + (placement.x + width / 2 - anchorX) * ratio;
        const centerY = anchorY + (placement.y + height / 2 - anchorY) * ratio;
        return [id, { ...placement, x: centerX - (width * ratio) / 2, y: centerY - (height * ratio) / 2 }];
      }),
    ),
  };
}

function shuffledLayout(pieces: Piece[], wall: Wall, current: Layout | undefined): Layout {
  const scaleOf = (piece: Piece) => current?.[piece.id]?.scale ?? 1;
  const positions = randomLayout(
    pieces.map((piece) => ({ id: piece.id, ...pieceSize(piece, wall, scaleOf(piece)) })),
    wall,
  );
  return Object.fromEntries(pieces.map((piece) => [piece.id, { ...positions[piece.id], scale: scaleOf(piece) }]));
}

export function Planner({ example, className = "h-dvh" }: { example?: Example; className?: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [layouts, setLayouts] = useState<Record<string, Layout>>({});
  const [chosenWallId, setChosenWallId] = useState<string>();
  const [saved, setSaved] = useState<Record<string, SavedLayout[]>>({});
  const [showMeasurements, setShowMeasurements] = useState(false);
  // One job per planning session, started by the first upload; AI costs are reported per job.
  const jobIdRef = useRef<string>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  const updatePhoto = (id: string, patch: Partial<Photo>) =>
    setPhotos((all) => all.map((photo) => (photo.id === id ? { ...photo, ...patch } : photo)));

  async function addPhoto(file: Blob, process: Processor, hiddenLabels: string[] = []) {
    const id = crypto.randomUUID();
    const { blob, width, height, pixels } = await preparePhoto(file);
    setPhotos((all) => [...all, { id, url: URL.createObjectURL(blob), width, height }]);
    const processed = process(blob);

    const analyze = processed.analysis.then((analysis) => {
      updatePhoto(id, { analysis, wall: analysis.wall ? wallSpace(analysis.wall, width, height) : undefined });
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
          hidden: hiddenLabels.includes(art.label),
        };
      });
      setPieces((all) => [...all, ...found]);
    });

    const clean = processed.cleanUrl.then((cleanUrl) => updatePhoto(id, { cleanUrl }));

    await Promise.all([analyze, clean]).catch((error) => {
      console.error(error);
      updatePhoto(id, { failed: true });
    });
  }

  // Load the example once (effects run twice in development).
  const exampleLoaded = useRef(false);
  useEffect(() => {
    if (!example || exampleLoaded.current) return;
    exampleLoaded.current = true;
    void fetch(example.photo)
      .then((response) => response.blob())
      .then((photo) =>
        addPhoto(
          photo,
          () => ({ analysis: Promise.resolve(example.analysis), cleanUrl: Promise.resolve(example.cleanUrl) }),
          example.hidden,
        ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the example is fixed for the planner's lifetime
  }, []);

  const walls = photos.flatMap((photo): Wall[] => (photo.wall ? [{ ...photo.wall, photo }] : []));
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

  const savedLayouts = (activeWall && saved[activeWall.photo.id]) ?? [];

  // Keeps the current layout as is. Storing the same object marks it as the one on the wall.
  function saveLayout() {
    if (!activeWall) return;
    const entry = { id: crypto.randomUUID(), layout, visibleIds: visiblePieces.map((piece) => piece.id) };
    setLayouts((all) => ({ ...all, [activeWall.photo.id]: layout }));
    setSaved((all) => ({ ...all, [activeWall.photo.id]: [...savedLayouts, entry] }));
  }

  function restoreLayout(entry: SavedLayout) {
    if (!activeWall) return;
    setLayouts((all) => ({ ...all, [activeWall.photo.id]: entry.layout }));
    setPieces((all) => all.map((piece) => ({ ...piece, hidden: !entry.visibleIds.includes(piece.id) })));
  }

  function changeWall(wall: WallSpace) {
    if (!activeWall) return;
    const wallId = activeWall.photo.id;
    const ratio = wall.pxPerCm / activeWall.pxPerCm;
    if (ratio !== 1) {
      const rescale = (placements: Layout) => rescaleLayout(placements, pieces, activeWall, ratio);
      // Saved layouts are rescaled too, and the current one keeps pointing at its saved entry.
      const rescaledSaved = savedLayouts.map((entry) => ({ ...entry, layout: rescale(entry.layout) }));
      const savedIndex = savedLayouts.findIndex((entry) => entry.layout === storedLayout);
      setSaved((all) => ({ ...all, [wallId]: rescaledSaved }));
      setLayouts((all) => ({ ...all, [wallId]: savedIndex >= 0 ? rescaledSaved[savedIndex].layout : rescale(layout) }));
    }
    updatePhoto(wallId, { wall });
  }

  function deleteLayout(id: string) {
    if (!activeWall) return;
    setSaved((all) => ({ ...all, [activeWall.photo.id]: savedLayouts.filter((entry) => entry.id !== id) }));
  }

  const itemsFor = (wall: Wall, placements: Layout, shown: Piece[]): StageItem[] =>
    shown.flatMap((piece) => {
      const placement = placements[piece.id];
      if (!placement) return [];
      return [{ ...piece, ...placement, ...pieceSize(piece, wall, placement.scale) }];
    });

  const stageItems = activeWall ? itemsFor(activeWall, layout, visiblePieces) : [];

  const processing = photos.some((photo) => !photo.failed && (!photo.analysis || !photo.cleanUrl));

  const uploadInput = (
    <input
      ref={fileInput}
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={(event) => {
        const jobId = (jobIdRef.current ??= crypto.randomUUID());
        for (const file of event.target.files ?? []) void addPhoto(file, viaApi(jobId));
        event.target.value = "";
      }}
    />
  );

  if (photos.length === 0) {
    return (
      <main className={`flex items-center justify-center bg-stone-100 ${className}`}>
        {uploadInput}
        {example ? (
          <Spinner className="h-8 w-8 text-stone-400" />
        ) : (
          <button
            className="rounded-full bg-stone-900 px-8 py-4 text-lg font-medium text-white hover:bg-stone-700"
            onClick={() => fileInput.current?.click()}
          >
            Upload photos
          </button>
        )}
      </main>
    );
  }

  return (
    <main className={`flex flex-col bg-stone-100 ${className}`}>
      {uploadInput}
      <header className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-2">
        <div className="mr-auto flex gap-2 overflow-x-auto">
          {!example && photos.map((photo) => {
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
        {activeWall?.photo.cleanUrl && savedLayouts.length > 0 && (
          // Newer layouts extend to the left, away from the buttons.
          <div className="flex max-w-[40vw] flex-row-reverse gap-2 overflow-x-auto p-1">
            {savedLayouts.map((entry, i) => (
              <div key={entry.id} className="group relative shrink-0">
                <button
                  onClick={() => restoreLayout(entry)}
                  className={`block overflow-hidden rounded-md ring-2 ${
                    storedLayout === entry.layout ? "ring-blue-500" : "ring-transparent hover:ring-stone-300"
                  }`}
                >
                  <LayoutPreview
                    wall={activeWall}
                    image={activeWall.photo.cleanUrl!}
                    items={itemsFor(activeWall, entry.layout, pieces.filter((piece) => entry.visibleIds.includes(piece.id)))}
                  />
                  <span className="absolute left-0.5 top-0.5 rounded bg-white/90 px-1 text-[10px] font-medium">{i + 1}</span>
                </button>
                <button
                  aria-label={`Delete layout ${i + 1}`}
                  onClick={() => deleteLayout(entry.id)}
                  className="absolute right-0.5 top-0.5 hidden h-4 w-4 items-center justify-center rounded-full bg-stone-900 text-[10px] text-white group-hover:flex"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          className="shrink-0 rounded-full border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-40"
          disabled={!activeWall?.photo.cleanUrl || stageItems.length === 0}
          onClick={saveLayout}
        >
          Save
        </button>
        {!example && (
          <button
            className="shrink-0 rounded-full border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
            onClick={() => fileInput.current?.click()}
          >
            Add photos
          </button>
        )}
        <button
          aria-pressed={showMeasurements}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-40 ${
            showMeasurements ? "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700" : "border-stone-300 hover:bg-stone-50"
          }`}
          disabled={!activeWall}
          onClick={() => setShowMeasurements((on) => !on)}
        >
          Measure
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
            wall={activeWall}
            showMeasurements={showMeasurements}
            onWallChange={changeWall}
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

// With the ring padding this matches the wall thumbnails, so the header keeps its height.
const PREVIEW_HEIGHT = 40;

// A small, static rendering of a layout on its wall.
function LayoutPreview({ wall, image, items }: { wall: Wall; image: string; items: StageItem[] }) {
  const scale = PREVIEW_HEIGHT / wall.photo.height;
  return (
    <div className="relative overflow-hidden" style={{ width: wall.photo.width * scale, height: PREVIEW_HEIGHT }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: wall.photo.width, height: wall.photo.height, transform: `scale(${scale})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
        <img src={image} alt="" className="absolute inset-0 h-full w-full" />
        {items.map((item) => (
          // eslint-disable-next-line @next/next/no-img-element -- generated data URL
          <img
            key={item.id}
            src={item.url}
            alt=""
            className="absolute"
            style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
          />
        ))}
      </div>
    </div>
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

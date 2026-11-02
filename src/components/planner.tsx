"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PhotoAnalysis } from "@/lib/analyze-photo";
import { boxToPixels, toPixels, unwarp } from "@/lib/geometry";
import { layoutAround, type WallSpace } from "@/lib/layout";
import {
  emptyPlanState,
  isProcessing,
  type Layout,
  type PlanData,
  type PlanState,
  type Placement,
  type SavedLayout,
  type StoredPhoto,
} from "@/lib/plan";
import { DeletePlan } from "./delete-plan";
import { WallStage, type StageItem } from "./wall-stage";

type Crop = { url: string; aspect: number };

type Piece = Crop & {
  id: string;
  label: string;
  longestCm: number;
  hidden: boolean;
  locked: boolean;
};

type Wall = WallSpace & { photo: StoredPhoto };

const MAX_EDGE = 2048;
const POLL_MS = 2000;
const SAVE_DELAY_MS = 600;

// Downscale before upload to stay well inside request size limits.
async function preparePhoto(file: Blob) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode photo"))), "image/jpeg", 0.9),
  );
  return { blob, width: canvas.width, height: canvas.height };
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
  return response;
}

// Cut each piece of art out of the photo. Crops are recreated on every load rather than stored.
async function cropArt(photo: StoredPhoto, analysis: PhotoAnalysis): Promise<Crop[]> {
  const bitmap = await createImageBitmap(await (await request(photo.url)).blob());
  const ctx = Object.assign(document.createElement("canvas"), { width: photo.width, height: photo.height }).getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, photo.width, photo.height);
  const pixels = ctx.getImageData(0, 0, photo.width, photo.height);
  return analysis.art.map(({ corners }) =>
    unwarp(pixels, {
      topLeft: toPixels(corners.topLeft, photo.width, photo.height),
      topRight: toPixels(corners.topRight, photo.width, photo.height),
      bottomRight: toPixels(corners.bottomRight, photo.width, photo.height),
      bottomLeft: toPixels(corners.bottomLeft, photo.width, photo.height),
    }),
  );
}

const pieceId = (photoId: string, index: number) => `${photoId}:${index}`;

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

// Locked pieces keep their place on this wall; a locked piece that isn't on it yet is arranged like the rest.
function shuffledLayout(pieces: Piece[], wall: Wall, current: Layout | undefined): Layout {
  const scaleOf = (piece: Piece) => current?.[piece.id]?.scale ?? 1;
  const kept = pieces.flatMap((piece) => {
    const placement = piece.locked && current?.[piece.id];
    return placement ? [{ id: piece.id, placement, ...pieceSize(piece, wall, placement.scale) }] : [];
  });
  const free = pieces.filter((piece) => !kept.some((k) => k.id === piece.id));
  const positions = layoutAround(
    free.map((piece) => ({ id: piece.id, ...pieceSize(piece, wall, scaleOf(piece)) })),
    wall,
    kept.map(({ placement: { x, y }, width, height }) => ({ left: x, top: y, right: x + width, bottom: y + height })),
  );
  return {
    ...Object.fromEntries(kept.map(({ id, placement }) => [id, placement])),
    ...Object.fromEntries(free.map((piece) => [piece.id, { ...positions[piece.id], scale: scaleOf(piece) }])),
  };
}

const toggled = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]);

const emptyPlan: PlanData = { id: null, photos: [], state: emptyPlanState };

// A plan is saved as you go once it has an id. The demo plan is never saved and takes no uploads.
export function Planner({
  initial = emptyPlan,
  demo = false,
  className = "h-dvh",
}: {
  initial?: PlanData;
  demo?: boolean;
  className?: string;
}) {
  const [planId, setPlanId] = useState(initial.id);
  const [photos, setPhotos] = useState(initial.photos);
  const [uploading, setUploading] = useState(0);
  const [crops, setCrops] = useState<Record<string, Crop[]>>({});
  const [wallEdits, setWallEdits] = useState(initial.state.walls);
  const [layouts, setLayouts] = useState(initial.state.layouts);
  const [saved, setSaved] = useState(initial.state.saved);
  const [hidden, setHidden] = useState(initial.state.hidden);
  const [locked, setLocked] = useState(initial.state.locked);
  const [chosenWallId, setChosenWallId] = useState(initial.state.chosenWallId);
  const [showMeasurements, setShowMeasurements] = useState(false);
  // New layout pulses until it's first pressed, since it's the main thing to do.
  const [hasShuffled, setHasShuffled] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // The first upload creates the plan, and the address becomes the plan's so a reload brings it back.
  async function ensurePlan() {
    if (planId) return planId;
    const { id } = (await (await request("/api/plans", { method: "POST" })).json()) as { id: string };
    setPlanId(id);
    window.history.replaceState(null, "", `/p/${id}`);
    return id;
  }

  async function upload(files: File[]) {
    setUploading((n) => n + files.length);
    const id = await ensurePlan().catch((error) => {
      console.error(error);
      setUploading((n) => n - files.length);
    });
    if (!id) return;
    await Promise.all(
      files.map(async (file) => {
        try {
          const { blob, width, height } = await preparePhoto(file);
          const response = await request(`/api/plans/${id}/photos?width=${width}&height=${height}`, {
            method: "POST",
            body: blob,
            headers: { "Content-Type": blob.type },
          });
          const photo = (await response.json()) as StoredPhoto;
          setPhotos((all) => (all.some((p) => p.id === photo.id) ? all : [...all, photo]));
        } catch (error) {
          console.error(error);
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
  }

  // Photos are processed on the server; check back until every one is done.
  const processing = photos.some(isProcessing);
  useEffect(() => {
    if (!planId || !processing) return;
    const timer = setInterval(async () => {
      const plan = (await (await request(`/api/plans/${planId}`)).json()) as PlanData;
      setPhotos(plan.photos);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [planId, processing]);

  const cropping = useRef(new Set<string>());
  useEffect(() => {
    for (const photo of photos) {
      const { analysis } = photo;
      if (!analysis || cropping.current.has(photo.id)) continue;
      cropping.current.add(photo.id);
      void cropArt(photo, analysis).then((photoCrops) => setCrops((all) => ({ ...all, [photo.id]: photoCrops })));
    }
  }, [photos]);

  const pieces = photos.flatMap((photo) => {
    const photoCrops = crops[photo.id];
    if (!photo.analysis || !photoCrops) return [];
    return photo.analysis.art.map((art, i): Piece => {
      const id = pieceId(photo.id, i);
      return {
        id,
        label: art.label,
        ...photoCrops[i],
        longestCm: Math.max(art.widthCm, art.heightCm),
        hidden: hidden.includes(id),
        locked: locked.includes(id),
      };
    });
  });

  const walls = photos.flatMap((photo): Wall[] => {
    const wall = wallEdits[photo.id] ?? (photo.analysis?.wall && wallSpace(photo.analysis.wall, photo.width, photo.height));
    return wall ? [{ ...wall, photo }] : [];
  });
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

  // Save shortly after each change, and right away when the page goes away. The layout on the wall
  // is included even when it was generated rather than touched, so a reload shows the same one.
  const planState: PlanState = {
    walls: wallEdits,
    layouts: activeWall ? { ...layouts, [activeWall.photo.id]: layout } : layouts,
    saved,
    hidden,
    locked,
    chosenWallId,
  };
  const stateJson = JSON.stringify(planState);
  const savedJson = useRef(JSON.stringify(initial.state));
  useEffect(() => {
    if (!planId || demo || stateJson === savedJson.current) return;
    const save = () => {
      savedJson.current = stateJson;
      void fetch(`/api/plans/${planId}`, {
        method: "PUT",
        body: stateJson,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(console.error);
    };
    const timer = setTimeout(save, SAVE_DELAY_MS);
    window.addEventListener("pagehide", save);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", save);
    };
  }, [planId, demo, stateJson]);

  function shuffle() {
    if (!activeWall) return;
    setHasShuffled(true);
    setLayouts((all) => ({ ...all, [activeWall.photo.id]: shuffledLayout(visiblePieces, activeWall, layout) }));
  }

  function changePlacement(id: string, change: Partial<Placement>) {
    if (!activeWall) return;
    setLayouts((all) => ({ ...all, [activeWall.photo.id]: { ...layout, [id]: { ...layout[id], ...change } } }));
  }

  const toggleHidden = (id: string) => setHidden((all) => toggled(all, id));
  const toggleLocked = (id: string) => setLocked((all) => toggled(all, id));

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
    setHidden(pieces.filter((piece) => !entry.visibleIds.includes(piece.id)).map((piece) => piece.id));
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
    setWallEdits((all) => ({ ...all, [wallId]: wall }));
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

  const canShuffle = !!activeWall?.photo.cleanUrl && visiblePieces.length > 0;
  const busy = processing || uploading > 0;

  const uploadInput = (
    <input
      ref={fileInput}
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={(event) => {
        void upload([...(event.target.files ?? [])]);
        event.target.value = "";
      }}
    />
  );

  if (photos.length === 0) {
    return (
      <main className={`flex items-center justify-center bg-stone-100 ${className}`}>
        {uploadInput}
        {demo || uploading > 0 ? (
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
          {!demo && photos.map((photo) => {
            const wall = walls.find((w) => w.photo.id === photo.id);
            const pending = isProcessing(photo);
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
                {/* eslint-disable-next-line @next/next/no-img-element -- stored photo */}
                <img src={photo.cleanUrl ?? photo.url} alt="" className="h-full w-full object-cover" />
                {pending && <Spinner className="absolute inset-0 m-auto h-5 w-5 text-white" />}
                {photo.failed && <span className="absolute inset-0 bg-red-500/50" />}
              </button>
            );
          })}
          {Array.from({ length: uploading }, (_, i) => (
            <div key={i} className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-stone-200">
              <Spinner className="h-5 w-5 text-stone-500" />
            </div>
          ))}
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
        {!demo && (
          <button
            className="shrink-0 rounded-full border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
            onClick={() => fileInput.current?.click()}
          >
            Add photos
          </button>
        )}
        {!demo && planId && <DeletePlan planId={planId} />}
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
          className="relative flex shrink-0 items-center gap-2 rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-40"
          disabled={!canShuffle}
          onClick={shuffle}
        >
          {canShuffle && !hasShuffled && (
            <span className="pointer-events-none absolute -inset-1 animate-pulse rounded-full border-2 border-[#c2683f]" />
          )}
          <ShuffleIcon className="h-4 w-4" />
          New layout
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
            onToggleLock={toggleLocked}
            wall={activeWall}
            showMeasurements={showMeasurements}
            onWallChange={changeWall}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-400">
            {busy ? <Spinner className="h-8 w-8" /> : "No wall found"}
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
        {/* eslint-disable-next-line @next/next/no-img-element -- stored photo */}
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

function ShuffleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
    </svg>
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

import { z } from "zod";
import type { PhotoAnalysis } from "./analyze-photo";
import type { WallSpace } from "./layout";

const box = z.object({ left: z.number(), top: z.number(), right: z.number(), bottom: z.number() });
const wallSpace = z.object({
  surface: box,
  hangAbove: z.object({ left: z.number(), right: z.number(), top: z.number() }),
  pxPerCm: z.number().positive(),
}) satisfies z.ZodType<WallSpace>;
const placement = z.object({ x: z.number(), y: z.number(), scale: z.number().positive() });
const layout = z.record(z.string(), placement);
const placeholder = z.object({ id: z.string(), widthCm: z.number().positive(), heightCm: z.number().positive() });

// Everything the user decides, keyed by photo and piece ids. Pieces are `${photoId}:${index}` into the photo's analysis,
// or a placeholder's id.
export const planStateSchema = z.object({
  // Corrections to the analyzed walls.
  walls: z.record(z.string(), wallSpace),
  layouts: z.record(z.string(), layout),
  saved: z.record(z.string(), z.array(z.object({ id: z.string(), layout, visibleIds: z.array(z.string()) }))),
  hidden: z.array(z.string()),
  // Pieces New layout leaves where they are.
  locked: z.array(z.string()).default([]),
  // Frames without a photo, sized by hand.
  placeholders: z.array(placeholder).default([]),
  chosenWallId: z.string().nullable(),
});

export type PlanState = z.infer<typeof planStateSchema>;
export type Placement = z.infer<typeof placement>;
export type Layout = z.infer<typeof layout>;
export type SavedLayout = PlanState["saved"][string][number];
export type Placeholder = z.infer<typeof placeholder>;

export const emptyPlanState: PlanState = { walls: {}, layouts: {}, saved: {}, hidden: [], locked: [], placeholders: [], chosenWallId: null };

// A photo as stored by the server. Analysis and the cleaned wall arrive while it's processed.
export type StoredPhoto = {
  id: string;
  url: string;
  width: number;
  height: number;
  analysis: PhotoAnalysis | null;
  cleanUrl: string | null;
  failed: boolean;
};

// `id` is null until the first upload creates the plan.
export type PlanData = { id: string | null; photos: StoredPhoto[]; state: PlanState };

export const isProcessing = (photo: StoredPhoto) => !photo.failed && (!photo.analysis || !photo.cleanUrl);

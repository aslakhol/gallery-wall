import { generateText, Output } from "ai";
import { z } from "zod";
import { jobTracking } from "./job";

const ANALYZE_MODEL = "google/gemini-3.8-flash";

// Coordinates are normalized to 0–1000 on both axes, which is how Gemini is trained to ground objects.
const point = z.object({ x: z.number(), y: z.number() });

const box = z.object({
  left: z.number(),
  top: z.number(),
  right: z.number(),
  bottom: z.number(),
});

const analysisSchema = z.object({
  art: z.array(
    z.object({
      label: z.string().describe("Two or three words describing the artwork, e.g. 'sailing ship print'"),
      corners: z
        .object({ topLeft: point, topRight: point, bottomRight: point, bottomLeft: point })
        .describe("Outer corners of the frame (or the artwork edge if unframed), as seen in the photo"),
      widthCm: z.number().describe("Estimated real outer width of the frame in cm"),
      heightCm: z.number().describe("Estimated real outer height of the frame in cm"),
    }),
  ),
  wall: z
    .object({
      surface: box.describe(
        "The free surface of the main wall facing the camera: from just below the ceiling down to the top of whatever is against the wall (or the floor if there is nothing). Stop at corners where another wall begins, and at windows and doors",
      ),
      surfaceWidthCm: z.number().describe("Estimated real width of surface in cm"),
      hangAbove: z
        .object({ left: z.number(), right: z.number(), top: z.number() })
        .describe(
          "The horizontal line a gallery wall would hang above: its left and right ends and its height. If furniture or a feature is against the wall (a sofa, sideboard, bed, desk, radiator or chair rail), where its top back edge meets the wall, only along this wall (e.g. not the chaise of a corner sofa reaching towards the camera). If there is nothing, where the bottom of a gallery wall would naturally sit, about 90 cm above the floor, spanning the middle of the wall",
        ),
    })
    .nullable()
    .describe("null if the photo doesn't show a wall that art could be hung on"),
});

export type PhotoAnalysis = z.infer<typeof analysisSchema>;

const PROMPT = `You are helping someone plan a gallery wall.

Find every framed picture, poster, painting or print in this photo, wherever it is: hanging, leaning against the wall, standing on furniture or lying on the floor. Windows, mirrors, screens, packaging, boxes and loose papers are not art.
Return the four outer corners of each in the photo, in 0–1000 normalized coordinates (x from the left edge, y from the top edge). Follow the frame's real outline, including perspective.

Estimate each frame's real outer size in cm. Use objects of known size in the photo (sockets, doors, sofas, chairs, floorboards) for scale. Most frames come in standard sizes (13×18, 18×24, 21×30, 24×30, 30×40, 40×50, 50×70, 60×80, 70×100 and their landscape versions, plus square 30×30, 40×40, 50×50) — snap to the closest standard size unless the frame is clearly custom.

If the photo shows a wall that art could be hung on, give its free surface, its real width in cm, and the line the art would hang above.`;

export async function analyzePhoto(image: Uint8Array, jobId: string) {
  const { output } = await generateText({
    model: ANALYZE_MODEL,
    providerOptions: jobTracking(jobId, "analyze"),
    output: Output.object({ schema: analysisSchema }),
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });
  return output;
}

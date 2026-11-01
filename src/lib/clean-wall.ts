import { generateText } from "ai";

const IMAGE_EDIT_MODEL = "google/gemini-nano-banana-2.1";

const PROMPT = `Edit this photo: remove every framed picture, poster, painting and print, whether it hangs on the wall, leans against it or stands on furniture or the floor. Also remove small loose clutter. Fill in what would be behind them naturally.

Keep everything else exactly as it is: same camera position, framing, perspective, lighting, colours, furniture and image proportions. Do not add anything.`;

export async function cleanWall(image: Uint8Array) {
  const { files } = await generateText({
    model: IMAGE_EDIT_MODEL,
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
  const cleaned = files.find((file) => file.mediaType.startsWith("image/"));
  if (!cleaned) throw new Error("The image model returned no image");
  return cleaned;
}

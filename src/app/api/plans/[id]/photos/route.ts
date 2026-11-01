import { after } from "next/server";
import { z } from "zod";
import { addPhoto, processPhoto } from "@/lib/plans";

// Processing runs after the response, within this limit.
export const maxDuration = 120;

const size = z.object({ width: z.coerce.number().int().positive(), height: z.coerce.number().int().positive() });

// Stores a photo (already downscaled to JPEG by the browser) and starts processing it.
export async function POST(request: Request, { params }: RouteContext<"/api/plans/[id]/photos">) {
  const { id } = await params;
  const dimensions = size.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!dimensions.success) return new Response(null, { status: 400 });
  const image = new Uint8Array(await request.arrayBuffer());
  const photo = await addPhoto(id, image, dimensions.data.width, dimensions.data.height);
  if (!photo) return new Response(null, { status: 404 });
  after(() => processPhoto(id, photo.id, image));
  return Response.json(photo);
}

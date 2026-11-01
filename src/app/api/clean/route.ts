import { cleanWall } from "@/lib/clean-wall";

export const maxDuration = 120;

export async function POST(request: Request) {
  const image = new Uint8Array(await request.arrayBuffer());
  const cleaned = await cleanWall(image);
  return new Response(Buffer.from(cleaned.uint8Array), { headers: { "Content-Type": cleaned.mediaType } });
}

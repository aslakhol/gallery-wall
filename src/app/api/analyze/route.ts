import { analyzePhoto } from "@/lib/analyze-photo";

export const maxDuration = 60;

export async function POST(request: Request) {
  const image = new Uint8Array(await request.arrayBuffer());
  return Response.json(await analyzePhoto(image));
}

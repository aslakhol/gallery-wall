import { createPlan } from "@/lib/plans";

export async function POST() {
  return Response.json({ id: await createPlan() });
}

import { planStateSchema } from "@/lib/plan";
import { deletePlan, getPlan, savePlanState } from "@/lib/plans";

export async function GET(_request: Request, { params }: RouteContext<"/api/plans/[id]">) {
  const plan = await getPlan((await params).id);
  return plan ? Response.json(plan) : new Response(null, { status: 404 });
}

export async function PUT(request: Request, { params }: RouteContext<"/api/plans/[id]">) {
  const state = planStateSchema.safeParse(await request.json());
  if (!state.success) return new Response(null, { status: 400 });
  const saved = await savePlanState((await params).id, state.data);
  return new Response(null, { status: saved ? 204 : 404 });
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/plans/[id]">) {
  const deleted = await deletePlan((await params).id);
  return new Response(null, { status: deleted ? 204 : 404 });
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Planner } from "@/components/planner";
import { getPlan } from "@/lib/plans";

// Plans are private to whoever has the link.
export const metadata: Metadata = { robots: { index: false } };

export default function PlanPage({ params }: PageProps<"/p/[id]">) {
  return (
    <Suspense fallback={<main className="h-dvh bg-stone-100" />}>
      <SavedPlan params={params} />
    </Suspense>
  );
}

async function SavedPlan({ params }: Pick<PageProps<"/p/[id]">, "params">) {
  const plan = await getPlan((await params).id);
  if (!plan) notFound();
  return <Planner initial={plan} />;
}

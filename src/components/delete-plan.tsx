"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function DeletePlan({ planId }: { planId: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function deletePlan() {
    setDeleting(true);
    setFailed(false);
    const response = await fetch(`/api/plans/${planId}`, { method: "DELETE" }).catch(() => null);
    if (response?.ok) {
      router.push("/");
      return;
    }
    setDeleting(false);
    setFailed(true);
  }

  return (
    <>
      <button
        aria-label="Delete plan"
        title="Delete plan"
        className="shrink-0 rounded-full border border-stone-300 p-2 text-stone-500 hover:bg-stone-50 hover:text-red-600"
        onClick={() => dialog.current?.showModal()}
      >
        <TrashIcon className="h-5 w-5" />
      </button>
      <dialog
        ref={dialog}
        className="m-auto max-w-sm rounded-2xl p-6 text-stone-900 shadow-xl backdrop:bg-stone-900/40"
      >
        <h2 className="text-lg font-semibold">Delete this plan?</h2>
        <p className="mt-2 text-sm text-stone-600">
          Your photos, art and layouts are deleted for good. This can&apos;t be undone, and you&apos;ll need to buy a
          new plan to start again.
        </p>
        {failed && <p className="mt-3 text-sm text-red-600">Couldn&apos;t delete the plan. Try again.</p>}
        <form method="dialog" className="mt-6 flex justify-end gap-2">
          <button className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={deletePlan}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete plan"}
          </button>
        </form>
      </dialog>
    </>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
    </svg>
  );
}

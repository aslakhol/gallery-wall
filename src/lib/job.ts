// Attribute AI Gateway usage to a job (one plan) and a step, so spend can be reported per job.
export const jobTracking = (jobId: string, step: "analyze" | "clean") => ({
  gateway: { user: jobId, tags: [step] },
});

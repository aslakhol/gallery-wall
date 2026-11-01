// Attribute AI Gateway usage to a job (one planning session) and a step, so spend can be reported per job.
export const JOB_HEADER = "x-job-id";

export const jobTracking = (jobId: string, step: "analyze" | "clean") => ({
  gateway: { user: jobId, tags: [step] },
});

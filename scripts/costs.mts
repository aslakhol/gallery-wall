// Prints AI Gateway spend per job. Usage: pnpm costs [days=30]
import { gateway } from "ai";

const days = Number(process.argv[2] ?? 30);
const endDate = new Date().toISOString().slice(0, 10);
const startDate = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

const [all, analyses] = await Promise.all([
  gateway.getSpendReport({ startDate, endDate, groupBy: "user" }),
  // One analyze request per uploaded photo.
  gateway.getSpendReport({ startDate, endDate, groupBy: "user", tags: ["analyze"] }),
]);

const photosByJob = new Map(analyses.results.map((row) => [row.user, row.requestCount ?? 0]));
const jobs = all.results
  .filter((row) => row.user)
  .map((row) => ({ job: row.user!, photos: photosByJob.get(row.user) ?? 0, cost: row.totalCost }))
  .filter((job) => job.photos > 0)
  .sort((a, b) => b.cost - a.cost);

const usd = (n: number) => `$${n.toFixed(3)}`;
console.table(jobs.map((job) => ({ ...job, cost: usd(job.cost), perPhoto: usd(job.cost / job.photos) })));

const total = jobs.reduce((sum, job) => sum + job.cost, 0);
const photos = jobs.reduce((sum, job) => sum + job.photos, 0);
const median = jobs.map((job) => job.cost).sort((a, b) => a - b)[Math.floor(jobs.length / 2)] ?? 0;
console.log(`${jobs.length} jobs, ${photos} photos since ${startDate}`);
console.log(`Average per job ${usd(total / (jobs.length || 1))}, median per job ${usd(median)}, average per photo ${usd(total / (photos || 1))}`);

import { put } from "@vercel/blob";
import { analyzePhoto, type PhotoAnalysis } from "./analyze-photo";
import { cleanWall } from "./clean-wall";
import { sql } from "./db";
import { emptyPlanState, planStateSchema, type PlanData, type PlanState, type StoredPhoto } from "./plan";

type PhotoRow = {
  id: string;
  url: string;
  width: number;
  height: number;
  analysis: PhotoAnalysis | null;
  clean_url: string | null;
  failed: boolean;
};

const toPhoto = ({ clean_url, ...row }: PhotoRow): StoredPhoto => ({ ...row, cleanUrl: clean_url });

export async function createPlan() {
  const id = crypto.randomUUID();
  await sql`insert into plans (id, state) values (${id}, ${JSON.stringify(emptyPlanState)})`;
  return id;
}

export async function getPlan(id: string): Promise<PlanData | null> {
  const [[plan], photos] = await Promise.all([
    sql`select state from plans where id = ${id}`,
    // Processing that never finished (the function timed out or crashed) counts as failed once it can no longer finish,
    // after the photos route's maxDuration.
    sql`
      select id, url, width, height, analysis, clean_url,
        failed or ((analysis is null or clean_url is null) and created_at < now() - interval '3 minutes') as failed
      from photos where plan_id = ${id} order by created_at
    `,
  ]);
  if (!plan) return null;
  return { id, state: planStateSchema.parse(plan.state), photos: (photos as PhotoRow[]).map(toPhoto) };
}

// Returns false when there is no such plan.
export async function savePlanState(id: string, state: PlanState) {
  const rows = await sql`update plans set state = ${JSON.stringify(state)}, updated_at = now() where id = ${id} returning id`;
  return rows.length > 0;
}

export async function addPhoto(planId: string, image: Uint8Array, width: number, height: number): Promise<StoredPhoto | null> {
  const [plan] = await sql`select id from plans where id = ${planId}`;
  if (!plan) return null;
  const id = crypto.randomUUID();
  const { url } = await put(`plans/${planId}/${id}.jpg`, Buffer.from(image), { access: "public", contentType: "image/jpeg" });
  await sql`insert into photos (id, plan_id, url, width, height) values (${id}, ${planId}, ${url}, ${width}, ${height})`;
  return { id, url, width, height, analysis: null, cleanUrl: null, failed: false };
}

// Analysis and cleanup are stored as each finishes, so the art shows up before the cleaned wall does.
// The plan is the job that AI costs are reported under.
export async function processPhoto(planId: string, photoId: string, image: Uint8Array) {
  const analyze = analyzePhoto(image, planId).then(
    (analysis) => sql`update photos set analysis = ${JSON.stringify(analysis)} where id = ${photoId}`,
  );
  const clean = cleanWall(image, planId).then(async (cleaned) => {
    const { url } = await put(`plans/${planId}/${photoId}-clean.${cleaned.mediaType.split("/")[1]}`, Buffer.from(cleaned.uint8Array), {
      access: "public",
      contentType: cleaned.mediaType,
    });
    await sql`update photos set clean_url = ${url} where id = ${photoId}`;
  });
  await Promise.all([analyze, clean]).catch(async (error) => {
    console.error(error);
    await sql`update photos set failed = true where id = ${photoId}`;
  });
}

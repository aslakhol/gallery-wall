# Gallery wall

Upload photos of a wall and your art. The app finds the art, removes it from the wall photo and lets you try layouts.

- `src/lib/analyze-photo.ts` finds the art, its corners and estimated size, and the hang area on the wall.
- `src/lib/clean-wall.ts` asks an image model for the same photo with the art removed.
- `src/lib/plans.ts` stores plans. The first upload creates a plan at `/p/<id>`. Photos go to Vercel Blob and are processed on the server after upload; the results land in the `photos` table. Everything the user decides is autosaved as one JSON document in `plans.state`. The server and the browser write to separate tables, so they never overwrite each other.
- Everything else (straightening the art, layouts, dragging) runs in the browser. The art is cut out of the photo again on every load rather than stored.

## Development

The project is linked to Vercel (`aslakhols-projects/gallery-wall`), with a Blob store and a Neon Postgres database, all in Frankfurt (`fra1`) next to the functions. `.env.local` needs:

```sh
AI_GATEWAY_API_KEY=...      # models, through Vercel AI Gateway
BLOB_READ_WRITE_TOKEN=...   # from `vercel env pull`
DATABASE_URL=...            # from `vercel env pull`
```

Then:

```sh
pnpm install
pnpm db:migrate   # applies db/schema.sql; safe to repeat
pnpm dev
```

On Vercel, AI Gateway authenticates automatically through the project's OIDC token.

## Costs

Every AI Gateway request is tagged with the job it belongs to (the plan's id) and its step (`analyze` or `clean`). Gateway records the cost, so nothing is stored here. To see spend per job:

```sh
pnpm costs      # last 30 days
pnpm costs 7    # last 7 days
```

Gateway's per-job report can lag a few minutes behind.


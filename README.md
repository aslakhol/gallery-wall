# Gallery wall

Upload photos of a wall and your art. The app finds the art, removes it from the wall photo and lets you try layouts.

- `src/lib/analyze-photo.ts` finds the art, its corners and estimated size, and the hang area on the wall.
- `src/lib/clean-wall.ts` asks an image model for the same photo with the art removed.
- Everything else (straightening the art, layouts, dragging) runs in the browser.

## Development

Models are called through Vercel AI Gateway. Put a key in `.env.local`:

```sh
AI_GATEWAY_API_KEY=...
```

Then:

```sh
pnpm install
pnpm dev
```

On Vercel, AI Gateway authenticates automatically through the project's OIDC token.

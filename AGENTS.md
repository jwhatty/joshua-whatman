<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project layout

Single-page portfolio, App Router, TypeScript only — no `.js`/`.jsx` anywhere.

- `src/app/` — `layout.tsx` (metadata + JSON-LD), `page.tsx` (declares the scene list), `globals.css` (all styling; there is no CSS-in-JS).
- `src/components/` — one file per component. `SceneStack` is the scroll engine; the four scenes are `Hero`, `WorkSection`, `About`, `Contact`.
- `src/lib/` — `data.ts` (content + feature flags), `fonts.ts`, `types.ts`, `utils.ts`.

`SceneStack` is the only place that touches the DOM imperatively, and deliberately: discrete scene state is CSS keyed off `data-scene-state`, and the single value written from JS is `--scene-inset`, the property that animates each frame. Add scene styling in `globals.css`, not inline.

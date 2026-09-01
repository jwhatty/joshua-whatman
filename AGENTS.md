<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project layout

Single-page portfolio, App Router, TypeScript only — no `.js`/`.jsx` anywhere.

- `src/app/` — `layout.tsx` (metadata + JSON-LD), `page.tsx` (declares the scene list), `globals.css` (all styling; there is no CSS-in-JS).
- `src/components/` — one file per component. `SceneStack` is the scroll engine; the four scenes are `Hero`, `WorkSection`, `About`, `Contact`; `Timecode`, `Slate` and `SoundToggle` are fixed playhead chrome.
- `src/lib/` — `data.ts` (content + feature flags), `playhead.ts` (frame bus), `sound.ts` (synthesized sound design), `fonts.ts`, `types.ts`, `utils.ts`.

`SceneStack` owns the only scroll listener. Per frame it writes two CSS vars on the animating layer — `--scene-inset` (wipe travel) and `--seam-amp` (waveform-tooth height on the wipe edge, zero at rest) — and publishes to `lib/playhead.ts`. Everything else that moves per frame (the timecode, the slate, the sound engine's crossfades) subscribes to that bus and writes its own nodes imperatively; nothing re-renders on scroll. Discrete scene state stays CSS keyed off `data-scene-state`. Add scene styling in `globals.css`, not inline.

All audio is synthesized in `lib/sound.ts` (noise + oscillators, no files), off by default, and only ever started from the `SoundToggle` click so the AudioContext is gesture-born.

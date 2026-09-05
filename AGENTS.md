<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project layout

Single-page portfolio, App Router, TypeScript only — no `.js`/`.jsx` anywhere.

- `src/app/` — `layout.tsx` (metadata + JSON-LD), `page.tsx` (declares the scene list), `globals.css` (all styling; there is no CSS-in-JS).
- `src/components/` — one file per component. `SceneStack` is the scroll engine; the four scenes are `Hero`, `WorkSection`, `About`, `Contact`; `Timecode`, `Slate` and `SoundToggle` are fixed playhead chrome; `ReelPlayer` is the full-screen video overlay.
- `src/lib/` — `data.ts` (content + feature flags), `playhead.ts` (frame bus), `reel.ts` (which reel the player is showing), `waveform.ts` (the one signal), `sound.ts` (synthesized sound design), `fonts.ts`, `types.ts`, `utils.ts`.

`SceneStack` owns the only scroll listener. Per frame it writes two CSS vars on the animating layer — `--scene-inset` (wipe travel) and `--seam-amp` (waveform-tooth height on the wipe edge, zero at rest) — and publishes to `lib/playhead.ts`. Everything else that moves per frame (the timecode, the slate, the sound engine's crossfades) subscribes to that bus and writes its own nodes imperatively; nothing re-renders on scroll. Discrete scene state stays CSS keyed off `data-scene-state`. Add scene styling in `globals.css`, not inline.

The about scene's entrance is the one React state hung off the bus: `About` subscribes and flips a single boolean (`about-live`) once a third of the scene is uncovered, from either direction, and every move — the title rising out of its mask, the still wiping in, the channel LEDs arming — is a CSS transition keyed off that class, so it plays on every arrival and plays back out on the way through. The frame-rate listener only ever sets the same boolean, which React bails out of.

All audio is synthesized in `lib/sound.ts` (noise + oscillators, no files), off by default, and only ever started from the `SoundToggle` click so the AudioContext is gesture-born.

## Video

Two players, on purpose. `VideoFrame` is the inline one for the work deck's monitor: poster until clicked, then a bare iframe, and unmounting the iframe is how it stops. `ReelPlayer` is the full-screen one — the *only* one at the root, portalled to `<body>` because a scene layer's `clip-path`/`contain` would trap a fixed overlay inside it. Anything anywhere opens it by calling `openReel(video)` from `lib/reel`; a trigger never has to be a video component, which is why the hero's reel is a transport bar (`ReelBar`) and not a 16:9 block.

**YouTube's controls are the visitor's.** The overlay's job is to give the reel the whole screen and then get out of the way — scrubbing, the logo, fullscreen, all of it. Our own chrome is the close button and the crop ticks, and nothing of ours sits over the picture once it's running. The one black we put on top is `.reel-cover`, and only until playback genuinely starts, so the embed's unstarted title bar never shows.

`ReelPlayer` runs no YouTube IFrame API script. It talks the embed's own `postMessage` channel (`enablejsapi=1`, post `listening`, read `playerState` back) for three things: knowing when there is a real picture to uncover, sending `playVideo`, and fading to black on end. Everything degrades on timers if the channel never answers — see the `Phase` doc comment.

**The embed loads before the click.** `lib/reel` has a second slot, `warm`: `ReelBar` puts its reel there once the page goes quiet and again the moment anyone reaches for the bar, and `ReelPlayer` mounts that embed straight away with `autoplay=0`, behind an invisible `inert` overlay. Pressing the bar is then a `playVideo` command rather than a cold YouTube load. Closing lets the frame go — unmounting the iframe is the only *guaranteed* stop — and re-warms a beat later, off the browser cache. `shouldWarm()` declines the whole trade on save-data, `prefers-reduced-data` or a 2G connection; the sockets themselves are opened earlier still by the `preconnect`s in `layout.tsx`.

Every waveform on the site — the reel bar, the player's cueing state, work posters with no art — comes from `lib/waveform.ts` through the `Waveform` component and the shared `.wave-bar` rule. Heights are rounded there because `Math.sin` differs between Node and the browser in the last bits, which hydration notices. Each slot owns its box and sets `--wave-height`.

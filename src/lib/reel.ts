import { useSyncExternalStore } from "react";
import type { Video } from "@/lib/types";

/**
 * Which reel the full-screen player is showing, as a tiny store rather than
 * component state. That's the whole point of the new player: the trigger no
 * longer has to *be* a video. Any button, link, cue row or keyboard shortcut
 * anywhere in the tree can call `openReel(video)` — there is exactly one
 * `<ReelPlayer />`, mounted once at the root, listening.
 */

let current: Video | null = null;
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach((listener) => listener());
}

/** Open the player on `video`. Safe to call while another reel is showing. */
export function openReel(video: Video): void {
    current = video;
    emit();
}

export function closeReel(): void {
    if (!current) return;
    current = null;
    emit();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getSnapshot(): Video | null {
    return current;
}

/** Nothing is ever open during SSR, so the server snapshot is always null. */
function getServerSnapshot(): Video | null {
    return null;
}

/** The reel the player should be showing, or null when it's closed. */
export function useReel(): Video | null {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

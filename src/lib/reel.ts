import { useEffect, useSyncExternalStore } from "react";
import type { Video } from "@/lib/types";

/**
 * Which reel the full-screen player is showing, and which one it should be
 * quietly getting ready, as a tiny store rather than component state. That's
 * the whole point of the new player: the trigger no longer has to *be* a video.
 * Any button, link, cue row or keyboard shortcut anywhere in the tree can call
 * `openReel(video)` — there is exactly one `<ReelPlayer />`, mounted once at
 * the root, listening.
 *
 * `warm` is the other half. A YouTube embed costs a connection, a chunk of
 * player JS and a player init before it can show a single frame, and doing all
 * of that *after* the click is what made opening a reel feel slow. So the
 * player mounts the embed ahead of the press — invisible, paused, autoplay off
 * — and the click has nothing left to do but say play.
 */

let current: Video | null = null;
let warm: Video | null = null;
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach((listener) => listener());
}

/** Open the player on `video`. Safe to call while another reel is showing. */
export function openReel(video: Video): void {
    current = video;
    emit();
}

/**
 * Close the player, and let go of the standby frame with it: unmounting the
 * embed is how playback is *guaranteed* to stop, and a paused-by-postMessage
 * frame we keep around is only as silent as the last command it happened to
 * receive. The player re-warms a beat later, off the browser cache.
 */
export function closeReel(): void {
    if (!current) return;
    current = null;
    warm = null;
    emit();
}

/**
 * Ask the player to mount this reel's embed now: no autoplay, no sound, just
 * the load. One slot, last caller wins — and a reel that is currently open is
 * never displaced, because that frame *is* the standby frame.
 */
export function warmReel(video: Video): void {
    if (current) return;
    if (warm?.videoId === video.videoId) return;
    if (!shouldWarm()) return;
    warm = video;
    emit();
}

type Connection = { saveData?: boolean; effectiveType?: string };

/**
 * Warming trades a few hundred kilobytes for the wait. Don't spend them where
 * the visitor has asked us not to, or on a connection slow enough that the
 * preload would compete with the page itself.
 */
function shouldWarm(): boolean {
    if (typeof window === "undefined") return false;
    if (window.matchMedia?.("(prefers-reduced-data: reduce)").matches) return false;

    const connection = (navigator as Navigator & { connection?: Connection }).connection;
    if (connection?.saveData) return false;
    if (connection?.effectiveType?.includes("2g")) return false;

    return true;
}

/**
 * Warm `video` once the page has gone quiet. For the hero's reel — the site's
 * primary action — that means it is usually ready before anyone reaches for it.
 */
export function useWarmOnIdle(video: Video): void {
    useEffect(() => {
        if (typeof window.requestIdleCallback !== "function") {
            const timer = window.setTimeout(() => warmReel(video), 1500);
            return () => window.clearTimeout(timer);
        }

        const handle = window.requestIdleCallback(() => warmReel(video), { timeout: 2500 });
        return () => window.cancelIdleCallback(handle);
    }, [video]);
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

function getWarmSnapshot(): Video | null {
    return warm;
}

/** Nothing is ever open or warm during SSR, so the server snapshot is always null. */
function getServerSnapshot(): Video | null {
    return null;
}

/** The reel the player should be showing, or null when it's closed. */
export function useReel(): Video | null {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The reel whose embed should be mounted and loading, open or not. */
export function useWarmReel(): Video | null {
    return useSyncExternalStore(subscribe, getWarmSnapshot, getServerSnapshot);
}

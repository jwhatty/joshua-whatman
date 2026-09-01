/**
 * The playhead: one tiny pub/sub carrying "where in the session are we".
 * SceneStack is the only publisher (it already owns the scroll rAF); the
 * timecode, the slate and the sound engine subscribe and write their own
 * nodes imperatively, so nothing re-renders per frame.
 */

export type PlayheadState = {
    /** Scroll position in scenes — fractional mid-wipe, integer when parked. */
    position: number;
    /** Scene currently under the playhead. */
    base: number;
    /** Scene wiping in over it, or -1 when parked on a snap point. */
    incoming: number;
    /** Eased wipe progress, 0 (base owns the screen) to 1 (incoming does). */
    wipe: number;
    /** Total scene count. */
    total: number;
};

type Listener = (state: PlayheadState) => void;

const listeners = new Set<Listener>();

let current: PlayheadState = { position: 0, base: 0, incoming: -1, wipe: 0, total: 1 };

export function publishPlayhead(state: PlayheadState) {
    current = state;
    listeners.forEach((listener) => listener(state));
}

/** Calls `listener` immediately with the latest state, then on every frame. */
export function subscribePlayhead(listener: Listener): () => void {
    listener(current);
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

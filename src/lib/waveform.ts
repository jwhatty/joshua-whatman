/**
 * The site's one waveform. Deterministic (index-driven, no `Math.random`) so
 * server and client render identical bars — three sines give the texture, an
 * envelope decides how much the ends taper off.
 *
 * Heights are rounded to four places on purpose: `Math.sin` is not required to
 * be correctly rounded, so Node and the browser disagree in the last bit or
 * two and React reports a hydration mismatch on the inline custom property.
 *
 * Every wave on the site is drawn from here at whatever bar count its slot
 * wants: the hero's transport bar, the player's cueing state, the work
 * posters. Same signal, different sizes.
 */

/** Default bar count — dense enough to read as a waveform, cheap enough to paint. */
export const WAVE_BARS = 56;

const cache = new Map<string, number[]>();

/**
 * Bar heights 0–1, memoised per (count, shape).
 *
 * `shape` is how much the ends taper: 1 is a poster's swell — loud in the
 * middle, quiet at the edges — and 0 is flat, which is what a long transport
 * strip wants so the signal reads evenly across the whole width.
 */
export function waveHeights(count: number = WAVE_BARS, shape = 1): number[] {
    const key = `${count}:${shape}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const heights = Array.from({ length: count }, (_, i) => {
        const texture =
            Math.sin(i * 0.82) * 0.32 + Math.sin(i * 2.19 + 1.3) * 0.22 + Math.sin(i * 5.71 + 0.4) * 0.14;
        const swell = Math.sin((i / Math.max(1, count - 1)) * Math.PI) * 0.55 + 0.25;
        const envelope = swell * shape + 0.62 * (1 - shape);
        const height = Math.min(1, Math.max(0.12, envelope * (1 + texture)));
        return Number(height.toFixed(4));
    });

    cache.set(key, heights);
    return heights;
}

/**
 * Negative animation delay per bar. Scatters the dance's phases so a *paused*
 * wave freezes on a frame that still reads as a real waveform, not a comb.
 */
export function barDelay(i: number): string {
    return `${-((i * 137) % 1400)}ms`;
}

/**
 * Where the bar sits along the strip, 0 at the head and 1 at the tail.
 *
 * The scattered `barDelay` is what makes a *frozen* wave look real; this is its
 * opposite and the sweep's whole trick — a delay that climbs with position, so
 * the same one-bar keyframe becomes a crest walking left to right instead of
 * 128 bars twitching at once. See `wave-sweep` in globals.css.
 */
export function barProgress(i: number, count: number): string {
    if (count < 2) return "0";
    return (i / (count - 1)).toFixed(4);
}

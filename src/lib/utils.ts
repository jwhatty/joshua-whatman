/** Clamp a number between min/max — used all over the scroll math. */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Scroll to a section marker by id. Smooth by default — the wipe between the
 * scenes it passes through is the point. Pass "instant" for a jump that skips
 * them: scrolling smoothly from the hero to the contact scene would otherwise
 * play every wipe in between on the way down.
 */
export function scrollToId(id: string, behavior: ScrollBehavior = "smooth"): void {
    document.getElementById(id)?.scrollIntoView({ behavior, block: "start" });
}

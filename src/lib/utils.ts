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

/**
 * Play a CSS animation again from the start of its active phase. The finished
 * animation named `name` on `el` (or anything under it) is seeked back to the
 * end of its delay and resumes; one still running is left alone, so a burst of
 * hovers can't stutter it. The keyframes and timing stay in the stylesheet —
 * this only rewinds them — and where reduced motion has set `animation: none`
 * there is nothing to find, so nothing happens.
 */
export function replayAnimation(el: Element, name: string): void {
    for (const anim of el.getAnimations({ subtree: true })) {
        if (!(anim instanceof CSSAnimation) || anim.animationName !== name) continue;
        if (anim.playState !== "finished") return;
        anim.currentTime = anim.effect?.getTiming().delay ?? 0;
        anim.play();
    }
}

/** Clamp a number between min/max — used all over the scroll math. */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/** Smooth-scroll to a section marker by id. */
export function scrollToId(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

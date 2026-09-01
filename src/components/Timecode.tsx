import { useEffect, useRef } from "react";
import { subscribePlayhead } from "@/lib/playhead";
import { monoFont } from "@/lib/fonts";
import { clamp } from "@/lib/utils";

function pad(n: number): string {
    return String(n).padStart(2, "0");
}

/**
 * SMPTE-style readout of the playhead — one scene scrubs one minute, frames
 * at 24fps. Written straight to the text node from the playhead bus so it
 * ticks every scroll frame without a single re-render.
 */
export function Timecode() {
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(
        () =>
            subscribePlayhead((state) => {
                const node = ref.current;
                if (!node) return;
                // rubber-band scroll produces positions outside the session
                const seconds = clamp(state.position, 0, state.total - 1) * 60;
                const mm = Math.floor(seconds / 60);
                const ss = Math.floor(seconds % 60);
                const ff = Math.floor((seconds - Math.floor(seconds)) * 24);
                node.textContent = `${pad(mm)}:${pad(ss)}:${pad(ff)}`;
            }),
        [],
    );

    return (
        <span ref={ref} className={`${monoFont.className} playhead-timecode`} aria-hidden="true">
            00:00:00
        </span>
    );
}

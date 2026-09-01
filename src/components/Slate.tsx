import { useEffect, useRef } from "react";
import { navItems, sectionOrder } from "@/lib/data";
import { subscribePlayhead } from "@/lib/playhead";
import { monoFont } from "@/lib/fonts";

const labels: Record<string, string> = Object.fromEntries(
    navItems.map((item) => [item.id, item.label]),
);

function pad(n: number): string {
    return String(n).padStart(2, "0");
}

/**
 * Film slate that flashes mid-wipe: scene number and name, and a take count
 * that climbs every time you cross the same seam again. Opacity is a bell
 * over wipe progress, written imperatively from the playhead bus; the
 * difference blend keeps it legible over ink and cream scenes alike.
 */
export function Slate() {
    const rootRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<HTMLSpanElement>(null);
    const takeRef = useRef<HTMLSpanElement>(null);
    const memo = useRef({ shown: -1, counted: -1, takes: new Map<number, number>() });

    useEffect(
        () =>
            subscribePlayhead((state) => {
                const root = rootRef.current;
                if (!root) return;

                if (state.incoming < 0) {
                    root.style.opacity = "0";
                    memo.current.counted = -1;
                    return;
                }

                if (memo.current.shown !== state.incoming) {
                    memo.current.shown = state.incoming;
                    const id = sectionOrder[state.incoming];
                    const label = labels[id] ?? id;
                    if (sceneRef.current) {
                        sceneRef.current.textContent =
                            `SCENE ${pad(state.incoming + 1)} · ${label.toUpperCase()}`;
                    }
                }

                // a take is "counted" once per pass through the middle of the seam
                if (state.wipe > 0.5 && memo.current.counted !== state.incoming) {
                    memo.current.counted = state.incoming;
                    const takes = memo.current.takes;
                    takes.set(state.incoming, (takes.get(state.incoming) ?? 0) + 1);
                }
                if (takeRef.current) {
                    const take = memo.current.takes.get(state.incoming) ?? 1;
                    takeRef.current.textContent = `J. WHATMAN · TAKE ${pad(Math.max(1, take))}`;
                }

                const bell = Math.max(0, Math.sin(Math.PI * state.wipe) * 1.5 - 0.5);
                root.style.opacity = bell.toFixed(3);
            }),
        [],
    );

    return (
        <div ref={rootRef} className={`${monoFont.className} slate`} aria-hidden="true">
            <span ref={sceneRef} className="slate-line" />
            <span ref={takeRef} className="slate-line slate-take" />
        </div>
    );
}

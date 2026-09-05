import { useEffect, useRef } from "react";
import { publishPlayhead } from "@/lib/playhead";
import type { Section } from "@/lib/types";
import { clamp } from "@/lib/utils";

/** How close to a scroll snap point counts as "one scene owns the screen". */
const SNAP_TOLERANCE_PX = 6;
/** Wipe is close enough to done that the incoming scene takes clicks. */
const INTERACTIVE_INSET = 4;
/**
 * Where inside a scroll segment the wipe actually runs. The gap either side is
 * dwell — the current scene holds still for a beat after one wipe finishes and
 * before the next begins, instead of them running back to back.
 */
const WIPE_START = 0.15;
const WIPE_END = 0.85;

type SceneState = "hidden" | "base" | "incoming";

/**
 * Smoothstep — soft start, soft stop. Unlike a cubic ease-in-out it doesn't cram
 * half the travel into the middle third, so the doors glide instead of snapping
 * through the centre.
 *
 * How fast the doors move at their quickest is (the curve's peak slope) divided
 * by (WIPE_END - WIPE_START): 1.5 / 0.7 here. Widening the window slows them
 * down but eats into the dwell between scenes — those are the two dials.
 */
function easeInOut(t: number): number {
    return t * t * (3 - 2 * t);
}

/**
 * Visibility, stacking and pointer-events live in CSS keyed off `data-scene-state`.
 * The only things written from JS are `--scene-inset` (how far the wipe has
 * travelled) and `--seam-amp` (how tall the waveform teeth on its edge are —
 * zero at both ends of the wipe so parked scenes always have straight edges).
 */
function setLayerState(layer: HTMLDivElement | null, state: SceneState, inset?: number) {
    if (!layer) return;
    layer.dataset.sceneState = state;
    layer.dataset.sceneInteractive = "false";
    if (inset !== undefined) {
        layer.style.setProperty("--scene-inset", `${inset}%`);
        layer.style.setProperty("--seam-amp", "0");
    }
}

type SceneStackProps = {
    sections: Section[];
    activeId: string;
    onActiveChange: (id: string) => void;
};

/** Turns scroll position into "which scene is on top" and animates the wipe between them. */
export function SceneStack({ sections, activeId, onActiveChange }: SceneStackProps) {
    const layers = useRef<(HTMLDivElement | null)[]>([]);
    // which layer is the base right now, and whether we're parked on a snap point
    const scene = useRef({ base: -1, locked: -1 });

    useEffect(() => {
        // cached so we're not reading layout on every scroll frame
        let viewportHeight = window.innerHeight;

        function update() {
            const total = sections.length;
            if (!viewportHeight || !total) return;

            const scroll = window.scrollY;
            const position = scroll / viewportHeight;

            const nearest = clamp(Math.round(position), 0, total - 1);
            const distance = Math.abs(scroll - nearest * viewportHeight);

            // few pixels of slack to account for trackpad/magic mouse weirdness
            if (distance <= SNAP_TOLERANCE_PX) {
                onActiveChange(sections[nearest].id);
                // publish the snapped integer, not the raw scroll — parked means
                // parked, so the timecode reads an even minute, not 00:59:23
                publishPlayhead({ position: nearest, base: nearest, incoming: -1, wipe: 0, total });

                if (scene.current.locked !== nearest) {
                    // show the active layer, hide everything else
                    layers.current.forEach((layer, i) => {
                        if (i === nearest) setLayerState(layer, "base", 0);
                        else setLayerState(layer, "hidden", 50);
                    });
                    scene.current = { base: nearest, locked: nearest };
                }
                return;
            }

            const base = clamp(Math.floor(position), 0, total - 1);
            const progress = clamp(position - base, 0, 1);
            const incoming = base + 1;
            const hasNext = incoming < total;

            onActiveChange(sections[nearest].id);

            // base layer changed since last frame, or we just came off a snap point
            if (scene.current.base !== base || scene.current.locked !== -1) {
                layers.current.forEach((layer, i) => {
                    if (i === base) setLayerState(layer, "base", 0);
                    // stage this one for the wipe below; its inset is set there
                    else if (hasNext && i === incoming) setLayerState(layer, "incoming");
                    // fully hidden, not just behind — "let's work" was bleeding through
                    else setLayerState(layer, "hidden", 50);
                });
                scene.current = { base, locked: -1 };
            }

            if (!hasNext) {
                publishPlayhead({ position: base, base, incoming: -1, wipe: 0, total });
                return;
            }
            const nextLayer = layers.current[incoming];
            if (!nextLayer) return;

            // dwell either side, then ease the wipe rather than tracking scroll linearly
            const wipe = clamp((progress - WIPE_START) / (WIPE_END - WIPE_START), 0, 1);
            const eased = easeInOut(wipe);
            const inset = (1 - eased) * 50;
            // the playhead follows the wipe, not the raw scroll: whenever the
            // screen looks parked (both dwell zones included), it reads an even
            // minute instead of drifting to 00:59:xx a few pixels shy of the snap
            publishPlayhead({ position: base + eased, base, incoming, wipe: eased, total });
            nextLayer.dataset.sceneState = "incoming";
            nextLayer.dataset.sceneInteractive = inset < INTERACTIVE_INSET ? "true" : "false";
            nextLayer.style.setProperty("--scene-inset", `${inset}%`);
            nextLayer.style.setProperty("--seam-amp", Math.sin(Math.PI * eased).toFixed(3));
        }

        // rAF-throttle the scroll handler
        let raf: number | null = null;
        function onScroll() {
            if (raf !== null) return;
            raf = requestAnimationFrame(() => {
                raf = null;
                update();
            });
        }

        function onResize() {
            viewportHeight = window.innerHeight;
            update();
        }

        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onResize);

        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onResize);
            if (raf !== null) cancelAnimationFrame(raf);
        };
    }, [sections, onActiveChange]);

    return (
        <div className="scene-track" style={{ height: `${sections.length * 100}vh` }}>
            <div className="scene-frame">
                {sections.map((section, i) => (
                    <div
                        key={section.id}
                        ref={(el) => {
                            layers.current[i] = el;
                        }}
                        // alternate the wipe style down the stack
                        className={`scene-layer ${i % 2 === 0 ? "scene-layer-door" : "scene-layer-shutter"}`}
                        data-scene-state="hidden"
                        style={{ background: section.bg, color: section.fg }}
                    >
                        {section.render(section.id === activeId)}
                    </div>
                ))}
            </div>

            {/* invisible markers so getElementById/scrollIntoView still work for nav clicks */}
            <div className="scene-markers">
                {sections.map((section) => (
                    <div key={section.id} id={section.id} className="scene-marker" />
                ))}
            </div>
        </div>
    );
}

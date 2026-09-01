import { motion, useScroll, useTransform } from "framer-motion";
import { sectionOrder } from "@/lib/data";
import { monoFont } from "@/lib/fonts";
import { scrollToId } from "@/lib/utils";

/** Scroll-down cues: the hero label fades out, a bare arrow fades in below it. */
export function ScrollHint({ activeId }: { activeId: string }) {
    const { scrollY } = useScroll();
    const topOpacity = useTransform(scrollY, [0, 80], [1, 0]);
    const bottomOpacity = useTransform(scrollY, [40, 140], [0, 1]);

    // whatever comes right after the current section, or null at the end
    const currentIndex = sectionOrder.indexOf(activeId);
    const nextId =
        currentIndex >= 0 && currentIndex < sectionOrder.length - 1
            ? sectionOrder[currentIndex + 1]
            : null;

    function handleClick() {
        if (nextId) scrollToId(nextId);
    }

    return (
        <>
            <motion.button
                type="button"
                className={`${monoFont.className} hero-scroll-cue-initial`}
                style={{ opacity: topOpacity }}
                onClick={handleClick}
                aria-label={nextId ? `Scroll to ${nextId}` : "Scroll down"}
                disabled={!nextId}
            >
                <span className="hero-scroll-label">SELECTED WORKS</span>
                <span className="hero-scroll-arrow">↓</span>
            </motion.button>

            {nextId && (
                <motion.button
                    type="button"
                    className={`${monoFont.className} hero-scroll-cue-bottom`}
                    style={{ opacity: bottomOpacity }}
                    onClick={handleClick}
                    aria-label={`Scroll to ${nextId}`}
                >
                    <span className="hero-scroll-arrow">↓</span>
                </motion.button>
            )}
        </>
    );
}

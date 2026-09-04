import { motion, useScroll, useTransform } from "framer-motion";
import { sectionOrder } from "@/lib/data";
import { monoFont } from "@/lib/fonts";
import { scrollToId } from "@/lib/utils";

/**
 * The bare arrow at the foot of the screen, fading in as the hero's own two
 * ways scroll out of reach. The labelled cue lives in `Hero` now — this one is
 * only the nudge, and it follows the scene order rather than naming a scene.
 */
export function ScrollHint({ activeId }: { activeId: string }) {
    const { scrollY } = useScroll();
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

    if (!nextId) return null;

    return (
        <motion.button
            type="button"
            className={`${monoFont.className} hero-scroll-cue-bottom`}
            style={{ opacity: bottomOpacity }}
            onClick={handleClick}
            aria-label={`Scroll to ${nextId}`}
        >
            <span className="hero-scroll-arrow">↓</span>
        </motion.button>
    );
}

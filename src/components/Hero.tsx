import { ReelBar } from "@/components/ReelBar";
import { Ticker } from "@/components/Ticker";
import { heroReel, visibleCategories } from "@/lib/data";
import { displayFont, monoFont } from "@/lib/fonts";
import { soundEngine } from "@/lib/sound";
import { replayAnimation, scrollToId } from "@/lib/utils";

// with every work category switched off there is no work scene to point at,
// so the first way out becomes "learn more" and lands on about instead
const firstWork = visibleCategories[0];
const firstWayId = firstWork?.id ?? "about";
const firstWayLabel = firstWork ? "SELECTED WORKS" : "LEARN MORE";

/**
 * Landing scene, as a masthead rather than a two-column pitch: the name at the
 * left, the discipline set against it at the right, the reel spanning the whole
 * measure between them as a transport bar, and the two quiet ways onward under
 * that. The reel is no longer a 16:9 block competing with the name for the eye
 * — pressing the bar hands the whole screen to `ReelPlayer`.
 */
export function Hero() {
    // contact is three scenes down, so it jumps: scrolling smoothly there would
    // play every wipe in between on the way. Both arrows are the one → glyph —
    // Nova Mono has no →, so it falls to the size-adjusted fallback and comes
    // out long and fine; ↓ it does have, and that one is a stub. Rotating the →
    // (globals.css, `hero-way-arrow-down`) keeps the pair identical in weight.
    const way = (id: string, label: string, direction: "down" | "right", behavior?: ScrollBehavior) => (
        <button
            type="button"
            className="hero-way"
            onClick={() => scrollToId(id, behavior)}
            onMouseEnter={() => soundEngine.tick()}
        >
            <span>{label}</span>
            <span className={`hero-way-arrow hero-way-arrow-${direction}`} aria-hidden="true">
                →
            </span>
        </button>
    );

    return (
        <div className="hero-inner">
            {/* fixed, but the scene layer's paint containment scopes it to this
                scene — it rides the top edge and wipes away with the hero */}
            <Ticker />

            <div className="hero-masthead">
                <div className="hero-name-row">
                    {/* waves hello on load (globals.css, `hero-wave`) and again
                        on hover or tap — pointerenter fires for both, a touch
                        being a pointer that arrives and leaves in one tap */}
                    <div
                        className="hero-logo"
                        aria-hidden="true"
                        onPointerEnter={(e) => {
                            soundEngine.tick();
                            replayAnimation(e.currentTarget, "hero-wave");
                        }}
                    >
                        <span className="hero-logo-mark" />
                    </div>

                    <h1 className={`${displayFont.className} hero-title`}>
                        <span className="hero-line">
                            <span className="hero-line-inner">JOSHUA</span>
                        </span>
                        <span className="hero-line">
                            <span className="hero-line-inner hero-line-second">WHATMAN</span>
                        </span>
                    </h1>
                </div>

                <p className={`${monoFont.className} hero-eyebrow`}>
                    <span className="hero-eyebrow-line">SOUND DESIGNER</span>
                    <span className="hero-eyebrow-line">MUSIC PRODUCER</span>
                    <span className="hero-eyebrow-line">DIGITAL MEDIA</span>
                </p>
            </div>

            <ReelBar reel={heroReel} />

            <div className={`${monoFont.className} hero-ways`}>
                {way(firstWayId, firstWayLabel, "down")}
                {way("contact", "GET IN TOUCH", "right", "instant")}
            </div>
        </div>
    );
}

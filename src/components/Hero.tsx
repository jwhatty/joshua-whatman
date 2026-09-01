import { ReelBar } from "@/components/ReelBar";
import { Ticker } from "@/components/Ticker";
import { heroReel, visibleCategories } from "@/lib/data";
import { displayFont, monoFont } from "@/lib/fonts";
import { soundEngine } from "@/lib/sound";
import { scrollToId } from "@/lib/utils";

// fall back to "about" if every work category is switched off
const firstWorkId = visibleCategories[0]?.id ?? "about";

/**
 * Landing scene, as a masthead rather than a two-column pitch: the name at the
 * left, the discipline set against it at the right, the reel spanning the whole
 * measure between them as a transport bar, and the two quiet ways onward under
 * that. The reel is no longer a 16:9 block competing with the name for the eye
 * — pressing the bar hands the whole screen to `ReelPlayer`.
 */
export function Hero() {
    // contact is three scenes down, so it jumps: scrolling smoothly there would
    // play every wipe in between on the way
    const way = (id: string, label: string, arrow: string, behavior?: ScrollBehavior) => (
        <button
            type="button"
            className="hero-way"
            onClick={() => scrollToId(id, behavior)}
            onMouseEnter={() => soundEngine.tick()}
        >
            <span>{label}</span>
            <span className="hero-way-arrow" aria-hidden="true">
                {arrow}
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
                    <div className="hero-logo" aria-hidden="true">
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
                    <span className="hero-eyebrow-line">DIGITAL MEDIA</span>
                </p>
            </div>

            <ReelBar reel={heroReel} />

            <div className={`${monoFont.className} hero-ways`}>
                {way(firstWorkId, "SELECTED WORKS", "↓")}
                {way("contact", "GET IN TOUCH", "→", "instant")}
            </div>
        </div>
    );
}

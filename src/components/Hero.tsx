import { VideoFrame } from "@/components/VideoFrame";
import { heroReel, visibleCategories } from "@/lib/data";
import { displayFont, monoFont } from "@/lib/fonts";
import { soundEngine } from "@/lib/sound";
import { scrollToId } from "@/lib/utils";

// fall back to "about" if every work category is switched off
const firstWorkId = visibleCategories[0]?.id ?? "about";

/** Landing scene — name, tagline and the big demo reel. */
export function Hero({ active }: { active: boolean }) {
    function scrollToWork() {
        scrollToId(firstWorkId);
    }

    return (
        <div className="hero-inner">
            <div className="hero-copy">
                <div className="hero-title-row">
                    <div className="hero-name-row">
                        <div className="hero-logo" aria-hidden="true">
                            <span className="hero-logo-mark" />
                        </div>

                        <h1 className={`${displayFont.className} hero-title`}>
                            JOSHUA
                            <br />
                            WHATMAN
                        </h1>
                    </div>

                    <div className="hero-title-block">
                        <p className={`${monoFont.className} hero-eyebrow`}>
                            SOUND DESIGNER • DIGITAL MEDIA
                        </p>

                        <div className="hero-scroll-cue-slot">
                            <button
                                type="button"
                                className={`${monoFont.className} hero-scroll-cue-static hero-cta`}
                                onClick={scrollToWork}
                                onMouseEnter={() => soundEngine.tick()}
                                aria-label="Scroll to selected work"
                            >
                                <span>SELECTED WORKS</span>
                                <span className="hero-scroll-arrow">↓</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="hero-reel">
                <VideoFrame
                    videoId={heroReel.videoId}
                    title={heroReel.title}
                    thumbnail={heroReel.thumbnail}
                    duration={heroReel.duration}
                    active={active}
                />
                <p className={`${monoFont.className} hero-reel-caption`}>{heroReel.title}</p>

                <button
                    type="button"
                    className={`${monoFont.className} hero-scroll-cue-mobile hero-cta`}
                    onClick={scrollToWork}
                    aria-label="Scroll to selected work"
                >
                    <span>SELECTED WORKS</span>
                    <span className="hero-scroll-arrow">↓</span>
                </button>
            </div>
        </div>
    );
}

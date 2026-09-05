import { useEffect, useState, type CSSProperties } from "react";
import { sectionOrder } from "@/lib/data";
import { displayFont, monoFont } from "@/lib/fonts";
import { subscribePlayhead } from "@/lib/playhead";
import { soundEngine } from "@/lib/sound";
import { scrollToId } from "@/lib/utils";

/** The hard facts, as tiles under the still. */
const FACTS = [
    { label: "YEARS IN AUDIO", value: "15+" },
    { label: "BASED IN", value: "VICTORIA, BC" },
    { label: "WHERE IT STARTED", value: "WINNIPEG" },
];

/** What he does — one channel each on the strip, armed as the scene lands. */
const CHANNELS = [
    "SOUND DESIGN",
    "MUSIC PRODUCTION",
    "RECORDING",
    "AUDIO POST",
    "RADIO",
    "CONCERT PRODUCTION",
    "LIVE RECORDING",
];

const aboutIndex = sectionOrder.indexOf("about");

/** How much of the scene has to be uncovered before its content comes on. */
const REVEAL_AT = 0.35;

/**
 * True while enough of the about scene is on screen for its content to be
 * up. Read off the playhead rather than the active-section state so it flips
 * at the same point of the wipe from either direction: the doors open on an
 * empty room, and the lights come on once they are a third of the way.
 * The entrance is a set of CSS transitions keyed off this one class, so it
 * plays on every arrival and reverses on the way out instead of snapping.
 * The listener runs per frame, but the boolean rarely changes, so React
 * bails out of the re-render on every other frame.
 */
function useOnStage(): boolean {
    const [onStage, setOnStage] = useState(false);

    useEffect(
        () =>
            subscribePlayhead((state) => {
                let exposure = 0;
                if (state.base === aboutIndex) exposure = state.incoming < 0 ? 1 : 1 - state.wipe;
                else if (state.incoming === aboutIndex) exposure = state.wipe;
                setOnStage(exposure >= REVEAL_AT);
            }),
        [],
    );

    return onStage;
}

/**
 * Bio scene, as a spread rather than a caption over a photo: the pitch and the
 * story on the left, the evidence on the right — the studio still, the hard
 * facts under it, and the disciplines as a strip of channels. The photo lives
 * in its own frame, so the copy never has to fight it for contrast.
 */
export function About() {
    const onStage = useOnStage();

    return (
        <div className={`about-inner ${onStage ? "about-live" : ""}`}>
            <div className="about-copy">
                <p className={`${monoFont.className} about-kicker`}>
                    <span>ABOUT ME</span>
                    <span className="about-kicker-rule" aria-hidden="true" />
                    <span>SOUND DESIGNER · MUSIC PRODUCER</span>
                </p>

                <h2 className={`${displayFont.className} about-title`}>
                    <span className="about-line">
                        <span className="about-line-inner">AUDIO CAN MAKE</span>
                    </span>
                    <span className="about-line">
                        <span className="about-line-inner about-line-second">
                            OR BREAK YOUR WORK<span className="about-period">.</span>
                        </span>
                    </span>
                </h2>

                <div className="about-body">
                    <p>
                        I fell in love with audio in Winnipeg over fifteen years ago and never
                        really recovered. I sat in as an intern on professional studio sessions,
                        ran my own studio engineering local artists, and built a talk show from
                        scratch for 101.5 UMFM.
                    </p>

                    <p>
                        That range, and my (at times, unsettling) passion for this craft, gives me
                        a deep and practical understanding of sound that shows up in everything I
                        make. If you need someone who will obsess over every detail, I’m your guy.
                    </p>
                </div>

                <button
                    type="button"
                    className={`${monoFont.className} about-cta`}
                    onClick={() => scrollToId("contact")}
                    onMouseEnter={() => soundEngine.tick()}
                >
                    <span>GET IN TOUCH</span>
                    <span className="about-cta-arrow" aria-hidden="true">
                        →
                    </span>
                </button>
            </div>

            <div className="about-side">
                <figure className="about-still">
                    <img
                        src="/studio.jpg"
                        alt="Joshua Whatman producing music at a computer in his recording studio as Spencer Lee plays bass behind him."
                        decoding="async"
                    />
                    <span className="about-still-ticks" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <i />
                    </span>
                    <figcaption className={`${monoFont.className} about-still-caption`}>
                        <span>IN THE STUDIO</span>
                        <span>SPENCER LEE ON BASS</span>
                    </figcaption>
                </figure>

                <dl className="about-facts">
                    {FACTS.map((fact, i) => (
                        <div
                            key={fact.label}
                            className="about-fact"
                            style={{ "--fact-i": i } as CSSProperties}
                        >
                            <dt className={monoFont.className}>{fact.label}</dt>
                            <dd className={displayFont.className}>{fact.value}</dd>
                        </div>
                    ))}
                </dl>

                <ul className={`${monoFont.className} about-channels`} aria-label="Disciplines">
                    {CHANNELS.map((name, i) => (
                        <li
                            key={name}
                            className="about-channel"
                            style={{ "--channel-i": i } as CSSProperties}
                            onMouseEnter={() => soundEngine.tick()}
                        >
                            <span className="about-channel-led" aria-hidden="true" />
                            {name}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

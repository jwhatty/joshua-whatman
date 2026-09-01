import type { CSSProperties } from "react";
import { displayFont, monoFont } from "@/lib/fonts";
import { soundEngine } from "@/lib/sound";

// 12 LED segments; the last two run hot, and the very last one peak-holds
const METER_SEGMENTS = Array.from({ length: 12 }, (_, i) => i);

/** Closing scene — the call to action and the credits. */
export function Contact() {
    return (
        <div className="contact-inner">
            <h2 className={`${displayFont.className} contact-line`}>
                LET’S WORK<span className="contact-period">.</span>
            </h2>

            <div className="contact-cta">
                <a
                    href="mailto:contact@joshuawhatman.com"
                    className={`${monoFont.className} contact-link`}
                    onMouseEnter={() => soundEngine.tick()}
                >
                    contact@joshuawhatman.com
                </a>

                <span className="contact-meter" aria-hidden="true">
                    {METER_SEGMENTS.map((i) => (
                        <span
                            key={i}
                            className={`contact-meter-seg ${i >= 10 ? "contact-meter-hot" : ""}`}
                            style={{ "--seg-i": i } as CSSProperties}
                        />
                    ))}
                </span>
            </div>

            <div className={`${monoFont.className} contact-credit`}>
                © 2026 Joshua Whatman
                <br />
                Photography: JazzPizza
                <br />
                Sound design: obviously
            </div>
        </div>
    );
}

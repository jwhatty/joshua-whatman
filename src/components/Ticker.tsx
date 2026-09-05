import { monoFont } from "@/lib/fonts";

// the services on offer, not the whole CV — that lives in the about copy
const ITEMS = ["SOUND DESIGN", "MUSIC PRODUCTION", "AUDIO POST"];

// enough passes per half that one half outspans any viewport; the loop
// shifts exactly one half, so the seam is invisible
const PASSES = 8;
const half = `${Array.from({ length: PASSES }, () => ITEMS).flat().join("  ·  ")}  ·  `;

/**
 * Hairline ticker across the top of the hero — the track list of the session.
 * Deliberately glacial (90s a lap) and faint; it wipes away with the scene,
 * and the nav takes over that edge everywhere else.
 */
export function Ticker() {
    return (
        <div className={`${monoFont.className} hero-ticker`} aria-hidden="true">
            <div className="hero-ticker-track">
                <span className="hero-ticker-half">{half}</span>
                <span className="hero-ticker-half">{half}</span>
            </div>
        </div>
    );
}

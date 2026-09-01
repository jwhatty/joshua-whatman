import { monoFont } from "@/lib/fonts";

// real disciplines from the about copy, not filler
const ITEMS = [
    "SOUND DESIGN",
    "MUSIC PRODUCTION",
    "AUDIO POST",
    "STUDIO RECORDING",
    "LIVE RECORDING",
    "CONCERT PRODUCTION",
    "RADIO",
];

// three passes per half so one half outspans any viewport; the loop shifts
// exactly one half, so the seam is invisible
const half = `${[...ITEMS, ...ITEMS, ...ITEMS].join("  ·  ")}  ·  `;

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

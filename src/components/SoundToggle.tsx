import { useState } from "react";
import { monoFont } from "@/lib/fonts";
import { soundEngine } from "@/lib/sound";

/**
 * Opt-in switch for the site's sound design. Off by default, always — the
 * click that turns it on is the user gesture that lets the AudioContext live.
 */
export function SoundToggle() {
    const [on, setOn] = useState(false);

    return (
        <button
            type="button"
            className={`${monoFont.className} sound-toggle ${on ? "sound-toggle-on" : ""}`}
            onClick={() => setOn(soundEngine.toggle())}
            aria-pressed={on}
            aria-label={on ? "Turn sound design off" : "Turn sound design on"}
        >
            <span className="sound-toggle-meter" aria-hidden="true">
                <span className="sound-toggle-bar" />
                <span className="sound-toggle-bar" />
                <span className="sound-toggle-bar" />
            </span>
            <span>SOUND {on ? "ON" : "OFF"}</span>
        </button>
    );
}

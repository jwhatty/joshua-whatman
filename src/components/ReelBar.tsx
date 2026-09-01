import { Waveform } from "@/components/Waveform";
import { monoFont } from "@/lib/fonts";
import { openReel } from "@/lib/reel";
import { soundEngine } from "@/lib/sound";
import type { Video } from "@/lib/types";

/** Wide slot, short bars — a transport strip wants far more than a poster. */
const BARS = 128;
/** Nearly flat: the signal should read the whole way across, not swell mid-bar. */
const SHAPE = 0.3;

type ReelBarProps = {
    reel: Video;
    /** Button copy. The waveform and runtime come from the reel itself. */
    label?: string;
};

/**
 * The hero's primary action: a transport bar, not a video. It carries the
 * waveform the old 16:9 poster used to — stretched into a strip so the signal
 * actually has room to read — and opens the reel full-screen when pressed.
 *
 * Idle it's a frozen waveform behind a hairline; hovered, the signal starts
 * moving and the play ring fills. The reward for reaching for it is the wave.
 */
export function ReelBar({ reel, label = "PLAY THE REEL" }: ReelBarProps) {
    return (
        <button
            type="button"
            className={`${monoFont.className} reel-bar`}
            onClick={() => openReel(reel)}
            onMouseEnter={() => soundEngine.tick()}
            aria-label={`Play ${reel.title} full screen`}
        >
            <span className="reel-bar-play" aria-hidden="true">
                <span className="reel-bar-play-icon" />
            </span>

            <span className="reel-bar-label">{label}</span>

            <Waveform className="reel-bar-wave" bars={BARS} shape={SHAPE} />

            {reel.duration && <span className="reel-bar-time">{reel.duration}</span>}
        </button>
    );
}

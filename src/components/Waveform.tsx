import type { CSSProperties } from "react";
import { barDelay, barProgress, waveHeights, WAVE_BARS } from "@/lib/waveform";

type WaveformProps = {
    /** Wrapper class — owns the size, gap, colour and when the bars run. */
    className: string;
    /** How many bars to draw. Wide slots want more. */
    bars?: number;
    /** How much the ends taper: 1 swells like a poster, 0 runs flat. */
    shape?: number;
};

/**
 * The waveform, as markup. Bars are frozen mid-dance by `.wave-bar`; each slot
 * decides in CSS when they start running (hover, cueing, touch's own sweep).
 *
 * Two phase properties per bar, because there are two ways for a wave to move:
 * `--bar-delay` scatters, `--bar-progress` marches. CSS picks one.
 */
export function Waveform({ className, bars = WAVE_BARS, shape = 1 }: WaveformProps) {
    return (
        <span className={className} aria-hidden="true">
            {waveHeights(bars, shape).map((height, i) => (
                <span
                    key={i}
                    className="wave-bar"
                    style={
                        {
                            "--bar-scale": height,
                            "--bar-delay": barDelay(i),
                            "--bar-progress": barProgress(i, bars),
                        } as CSSProperties
                    }
                />
            ))}
        </span>
    );
}

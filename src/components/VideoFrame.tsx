import { useEffect, useRef, useState } from "react";
import { Waveform } from "@/components/Waveform";
import { monoFont } from "@/lib/fonts";
import { soundEngine } from "@/lib/sound";

const YT_ALLOW =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

type VideoFrameProps = {
    videoId: string;
    title: string;
    thumbnail?: string;
    duration?: string;
    active?: boolean;
    /** Mount already playing — for cue-list loads, where the click was the intent. */
    autoPlay?: boolean;
};

/**
 * Lite click-to-play embed: nothing but the poster until clicked, then a bare
 * youtube-nocookie iframe — no YouTube IFrame API script, no Player objects.
 * "Stop playing" is simply unmounting the iframe, which happens when the scene
 * goes inactive or the frame scrolls out of view.
 *
 * This is the *inline* player, for the work deck's monitor. The hero's reel
 * opens full-screen instead — see `ReelPlayer`.
 */
export function VideoFrame({
    videoId,
    title,
    thumbnail,
    duration,
    active = true,
    autoPlay = false,
}: VideoFrameProps) {
    const frameRef = useRef<HTMLDivElement>(null);
    const [started, setStarted] = useState(autoPlay);

    // Scenes don't unmount when scrolled off, they get hidden — so a scene going
    // inactive is what "stop playing" means here. Adjusting state during render
    // rather than in an effect avoids a pass with the iframe still live.
    const [wasActive, setWasActive] = useState(active);
    if (wasActive !== active) {
        setWasActive(active);
        if (!active) setStarted(false);
    }

    // Within a live scene (the mobile carousel), a playing frame that scrolls
    // out of view also unmounts rather than droning on off-screen.
    useEffect(() => {
        const frame = frameRef.current;
        if (!started || !frame) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) setStarted(false);
            },
            { threshold: 0.1 },
        );
        observer.observe(frame);
        return () => observer.disconnect();
    }, [started]);

    return (
        <div ref={frameRef} className="video-frame">
            {started ? (
                <iframe
                    className="video-iframe"
                    src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`}
                    title={title}
                    allow={YT_ALLOW}
                    allowFullScreen
                />
            ) : (
                <button
                    type="button"
                    onClick={() => setStarted(true)}
                    onMouseEnter={() => soundEngine.tick()}
                    className="video-placeholder"
                    aria-label={`Play ${title}`}
                >
                    {thumbnail ? (
                        <img src={thumbnail} alt="" className="video-thumbnail" />
                    ) : (
                        // no art yet: the waveform is the poster, paused until hover
                        <Waveform className="video-wave" />
                    )}
                    <span className="video-thumbnail-overlay" />
                    <span className="video-grain" />
                    <span className="video-play">
                        <span className="video-play-icon" />
                    </span>
                    <span className={`${monoFont.className} video-title`}>{title}</span>
                    {duration && (
                        <span className={`${monoFont.className} video-duration`}>{duration}</span>
                    )}
                </button>
            )}
        </div>
    );
}

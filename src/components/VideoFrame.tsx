import { useEffect, useRef, useState } from "react";
import { monoFont } from "@/lib/fonts";
import type { YouTubePlayer } from "@/lib/types";

const YT_ALLOW =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
const YT_SCRIPT_ID = "youtube-iframe-api";

type VideoFrameProps = {
    videoId: string;
    title: string;
    thumbnail?: string;
    active?: boolean;
};

/** Click-to-play YouTube embed: thumbnail until started, iframe after. */
export function VideoFrame({ videoId, title, thumbnail, active = true }: VideoFrameProps) {
    const frameRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YouTubePlayer | null>(null);
    const [started, setStarted] = useState(false);

    // Scenes don't unmount when scrolled off, they get hidden — so a scene going
    // inactive is what "stop playing" means here. Adjusting state during render
    // rather than in an effect avoids a pass with the iframe still live.
    const [wasActive, setWasActive] = useState(active);
    if (wasActive !== active) {
        setWasActive(active);
        if (!active) setStarted(false);
    }

    // The YouTube iframe API is an external system, so it does belong in an effect.
    useEffect(() => {
        const frame = frameRef.current;
        if (!started || !frame) return;

        let observer: IntersectionObserver | undefined;

        // Once the player is live, stop and rewind it as soon as it leaves the viewport.
        const watchVisibility = () => {
            observer = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) return;
                    playerRef.current?.pauseVideo();
                    playerRef.current?.seekTo(0, false);
                    setStarted(false);
                },
                { threshold: 0.1 },
            );
            observer.observe(frame);
        };

        const attachPlayer = () => {
            // frameRef wraps the iframe, so grab the actual node
            const iframe = frame.querySelector("iframe");
            if (!iframe || !window.YT) return;
            playerRef.current = new window.YT.Player(iframe, {
                events: { onReady: watchVisibility },
            });
        };

        if (window.YT?.Player) {
            attachPlayer();
        } else {
            // the script only needs adding once, other VideoFrames reuse it
            if (!document.getElementById(YT_SCRIPT_ID)) {
                const script = document.createElement("script");
                script.id = YT_SCRIPT_ID;
                script.src = "https://www.youtube.com/iframe_api";
                document.body.appendChild(script);
            }

            const previousReady = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                previousReady?.();
                if (frameRef.current) attachPlayer();
            };
        }

        return () => {
            observer?.disconnect();
            playerRef.current?.destroy();
            playerRef.current = null;
        };
    }, [started]);

    return (
        <div ref={frameRef} className="video-frame">
            {started ? (
                <iframe
                    className="video-iframe"
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`}
                    title={title}
                    allow={YT_ALLOW}
                    allowFullScreen
                />
            ) : (
                <button
                    type="button"
                    onClick={() => setStarted(true)}
                    className="video-placeholder"
                    aria-label={`Play ${title}`}
                >
                    {thumbnail && <img src={thumbnail} alt="" className="video-thumbnail" />}
                    <span className="video-thumbnail-overlay" />
                    <span className="video-grain" />
                    <span className="video-play">
                        <span className="video-play-icon" />
                    </span>
                    <span className={`${monoFont.className} video-title`}>{title}</span>
                </button>
            )}
        </div>
    );
}

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Waveform } from "@/components/Waveform";
import { monoFont } from "@/lib/fonts";
import { closeReel, useReel } from "@/lib/reel";
import { soundEngine } from "@/lib/sound";

const YT_ALLOW =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
/** Where the embed's status messages legitimately come from. */
const YT_ORIGINS = ["https://www.youtube-nocookie.com", "https://www.youtube.com"];

/** The three player states we act on. */
const ENDED = 0;
const PLAYING = 1;
const PAUSED = 2;

/** How long the overlay takes to fade out — the reel is held that long past close. */
const EXIT_MS = 280;
/** Beat before the chrome settles back into the film. */
const SETTLE_MS = 2600;
/**
 * How long the cover waits on a loaded-but-not-yet-playing embed. Where
 * autoplay is allowed the player reports PLAYING well inside this; where it is
 * blocked (Safari, iOS) we switch the cover to a play prompt instead.
 */
const REVEAL_MS = 1600;
/** Uncover anyway if the embed never fires `load` — better a frame than a forever wave. */
const REVEAL_CEILING_MS = 5000;
/** Fade to black on the last frame, then put the frame away. */
const ENDED_MS = 600;

/**
 * cueing  — black, waveform, embed still coming up
 * prompt  — black, our play mark; autoplay was refused, and the cover is
 *           click-through so pressing it lands on the embed underneath, which
 *           is the in-frame gesture Safari insists on
 * playing — cover gone, picture owns the screen
 * paused  — picture held under a veil and our play mark
 * ended   — black again, on the way out
 */
type Phase = "cueing" | "prompt" | "playing" | "paused" | "ended";

/**
 * Nothing but the picture: no control bar, no related grid, no fullscreen
 * button — the overlay *is* the fullscreen.
 *
 * `enablejsapi` buys us the embed's status channel (see below) and nothing
 * else; there is still no IFrame API script on the page. `modestbranding` is
 * absent because YouTube stopped honouring it.
 */
function embedSrc(videoId: string): string {
    const params = new URLSearchParams({
        autoplay: "1",
        playsinline: "1",
        rel: "0",
        controls: "0",
        iv_load_policy: "3",
        fs: "0",
        color: "white",
        enablejsapi: "1",
        origin: window.location.origin,
    });
    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

/**
 * The one player on the site, mounted once at the root and driven by
 * `lib/reel`. Any button anywhere calls `openReel(video)`; this fades a
 * full-screen frame over everything, holds a waveform while the embed cues,
 * then hands the screen to the picture.
 *
 * It portals to `document.body` on purpose: the scene layers are clipped
 * (`clip-path`) and contained (`contain: strict`), either of which would trap
 * a fixed overlay inside the hero.
 */
export function ReelPlayer() {
    const requested = useReel();
    const [mounted, setMounted] = useState(false);
    // held one beat past close so the overlay can fade out instead of vanishing
    const [showing, setShowing] = useState(requested);
    const [open, setOpen] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [phase, setPhase] = useState<Phase>("cueing");
    const [settled, setSettled] = useState(false);

    const overlayRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<HTMLIFrameElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const returnFocus = useRef<HTMLElement | null>(null);
    // whether the embed's status channel ever answered us
    const heard = useRef(false);

    useEffect(() => setMounted(true), []);

    /** Drive the embed over the same channel it reports state on. */
    function command(func: string) {
        frameRef.current?.contentWindow?.postMessage(
            JSON.stringify({ event: "command", func, args: [], id: 1, channel: "widget" }),
            "*",
        );
    }

    // mirror the store
    useEffect(() => {
        if (requested) {
            returnFocus.current = document.activeElement as HTMLElement | null;
            setShowing(requested);
            setLoaded(false);
            setPhase("cueing");
            setSettled(false);
            heard.current = false;
            // next frame, so the enter transition has a "from" state to run from
            const raf = requestAnimationFrame(() => setOpen(true));
            return () => cancelAnimationFrame(raf);
        }

        setOpen(false);
        const timer = window.setTimeout(() => setShowing(null), EXIT_MS);
        return () => window.clearTimeout(timer);
    }, [requested]);

    // while a reel is up the overlay is the whole world: page frozen and inert,
    // Escape closes, Tab can't wander off, and the site's own room tone ducks
    useEffect(() => {
        if (!showing) return;

        const root = document.documentElement;
        const site = document.querySelector("main");
        const previousOverflow = root.style.overflow;

        // the site hides its scrollbars, so freezing scroll costs no layout shift
        root.style.overflow = "hidden";
        site?.setAttribute("inert", "");
        soundEngine.duck(true);
        closeRef.current?.focus({ preventScroll: true });

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                closeReel();
                return;
            }
            if (event.key !== "Tab") return;

            // the scrim is a button too, but it's aria-hidden and untabbable —
            // wrapping focus onto it would be a dead end
            const stops = overlayRef.current?.querySelectorAll<HTMLElement>(
                'button:not([tabindex="-1"]), iframe',
            );
            if (!stops || stops.length === 0) return;

            const first = stops[0];
            const last = stops[stops.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            root.style.overflow = previousOverflow;
            site?.removeAttribute("inert");
            soundEngine.duck(false);
            returnFocus.current?.focus({ preventScroll: true });
        };
    }, [showing]);

    // the chrome sits up for a beat, then settles into the film. It never leaves —
    // reaching for the close brings the whole set back.
    useEffect(() => {
        if (!showing) return;
        const timer = window.setTimeout(() => setSettled(true), SETTLE_MS);
        return () => window.clearTimeout(timer);
    }, [showing]);

    // The picture normally arrives on the embed's own PLAYING message. If that
    // hasn't come a beat after load, autoplay was refused — ask for the press
    // if the channel is talking to us, and if it never was, just uncover and
    // let the embed speak for itself.
    useEffect(() => {
        if (!showing || phase !== "cueing") return;
        const timer = window.setTimeout(
            () => setPhase(heard.current ? "prompt" : "playing"),
            loaded ? REVEAL_MS : REVEAL_CEILING_MS,
        );
        return () => window.clearTimeout(timer);
    }, [showing, loaded, phase]);

    // Talk the embed's own message channel instead of pulling in the IFrame API
    // script: post "listening" until the player answers, then read its state off
    // the replies. That state is what lets us keep YouTube's own chrome off the
    // screen — see `.reel-guard` below. If it never answers, the timers above
    // still uncover the picture and the embed handles its own clicks.
    useEffect(() => {
        if (!showing || !open) return;

        let endTimer = 0;
        let ping = 0;

        function onMessage(event: MessageEvent) {
            if (!YT_ORIGINS.includes(event.origin)) return;

            let data: unknown;
            try {
                data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
            } catch {
                return;
            }

            heard.current = true;
            window.clearInterval(ping);

            const info = (data as { info?: unknown }).info;
            const state =
                typeof info === "number"
                    ? info
                    : (info as { playerState?: number } | undefined)?.playerState;

            if (state === PLAYING) setPhase("playing");
            if (state === PAUSED) setPhase("paused");
            if (state === ENDED) {
                // cut to black on the last frame rather than letting YouTube's
                // end screen show, then take the frame away
                setPhase("ended");
                endTimer = window.setTimeout(closeReel, ENDED_MS);
            }
        }

        window.addEventListener("message", onMessage);

        // the embed ignores us until its player is up, so keep asking
        ping = window.setInterval(() => {
            frameRef.current?.contentWindow?.postMessage(
                JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
                "*",
            );
        }, 250);

        return () => {
            window.removeEventListener("message", onMessage);
            window.clearInterval(ping);
            window.clearTimeout(endTimer);
        };
    }, [showing, open]);

    if (!mounted || !showing) return null;

    const meta = [showing.title, showing.duration].filter(Boolean).join("  ·  ");
    // Only take the picture's clicks once we know we can drive it. The guard is
    // what stops a stray mouse move summoning YouTube's title bar and "Watch on
    // YouTube" strip, so it earns its keep even while playing.
    const guarded = heard.current && (phase === "playing" || phase === "paused");

    return createPortal(
        <div
            ref={overlayRef}
            className={`${monoFont.className} reel-overlay ${open ? "is-open" : ""} ${
                settled ? "is-settled" : ""
            }`}
            data-phase={phase}
            role="dialog"
            aria-modal="true"
            aria-label={showing.title}
        >
            {/* everything outside the frame closes it */}
            <button
                type="button"
                className="reel-scrim"
                onClick={closeReel}
                tabIndex={-1}
                aria-hidden="true"
            />

            <div className="reel-stage">
                <span className="reel-ticks" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                </span>

                {open && (
                    <iframe
                        key={showing.videoId}
                        ref={frameRef}
                        className="reel-player"
                        src={embedSrc(showing.videoId)}
                        title={showing.title}
                        allow={YT_ALLOW}
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                        onLoad={() => setLoaded(true)}
                    />
                )}

                {guarded && (
                    <button
                        type="button"
                        className="reel-guard"
                        onClick={() => command(phase === "paused" ? "playVideo" : "pauseVideo")}
                        aria-label={phase === "paused" ? "Resume" : "Pause"}
                    />
                )}

                {/* paused is ours too: the picture holds under a veil and a play mark */}
                <span className="reel-veil" aria-hidden="true">
                    <span className="reel-mark">
                        <span className="reel-mark-icon" />
                    </span>
                </span>

                {/* Our own black over the embed until it is genuinely playing, so
                    YouTube's unstarted title bar and "Watch on YouTube" strip never
                    show. Click-through while prompting; the shields keep a stray
                    press off those same (invisible) links. */}
                <span className="reel-cover">
                    <span className="reel-cueing">
                        <Waveform className="reel-cueing-wave" bars={48} shape={0.75} />
                        <span className="reel-cueing-label">CUEING</span>
                    </span>

                    <span className="reel-prompt">
                        <span className="reel-mark">
                            <span className="reel-mark-icon" />
                        </span>
                        <span className="reel-prompt-label">
                            <span className="on-fine">PRESS PLAY</span>
                            <span className="on-coarse">TAP TO PLAY</span>
                        </span>
                    </span>

                    <span className="reel-shield reel-shield-top" />
                    <span className="reel-shield reel-shield-bottom" />
                </span>
            </div>

            <button type="button" ref={closeRef} className="reel-close" onClick={closeReel}>
                <span className="reel-close-label">CLOSE</span>
                <span className="reel-close-mark" aria-hidden="true" />
            </button>

            <p className="reel-meta">{meta}</p>

            <p className="reel-hint" aria-hidden="true">
                <span className="on-fine">CLICK TO PAUSE</span>
                <span className="on-coarse">TAP TO PAUSE</span>
                <span className="reel-hint-esc">  ·  ESC TO CLOSE</span>
            </p>
        </div>,
        document.body,
    );
}

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Waveform } from "@/components/Waveform";
import { monoFont } from "@/lib/fonts";
import { closeReel, useReel, useWarmReel, warmReel } from "@/lib/reel";
import { soundEngine } from "@/lib/sound";
import type { Video } from "@/lib/types";

const YT_ALLOW =
    "accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share";
/** Where the embed's status messages legitimately come from. */
const YT_ORIGINS = ["https://www.youtube-nocookie.com", "https://www.youtube.com"];

/** The three player states we act on. */
const ENDED = 0;
const PLAYING = 1;
const PAUSED = 2;

/** How long the overlay takes to fade out — the reel is held that long past close. */
const EXIT_MS = 220;
/** Beat before the chrome settles back into the film. */
const SETTLE_MS = 2600;
/** After that, put the embed back on standby: it's in the cache, so it's cheap. */
const REWARM_MS = 800;
/**
 * How long the cover waits on a loaded-but-not-yet-playing embed. Where
 * autoplay is allowed the player reports PLAYING well inside this; where it is
 * blocked (Safari, iOS) we switch the cover to a play prompt instead.
 */
const REVEAL_MS = 1600;
/** A standby frame is up and asked to play: it either takes at once or it was refused. */
const WARM_REVEAL_MS = 700;
/** Uncover anyway if the embed never fires `load` — better a frame than a forever wave. */
const REVEAL_CEILING_MS = 5000;
/** Fade to black on the last frame, then put the frame away. */
const ENDED_MS = 600;

/** How often we talk to the embed while we're waiting for a picture, and for how long. */
const PING_MS = 250;
const PING_LIMIT = 24;

/**
 * cueing  — black, waveform, embed still coming up
 * prompt  — black, our play mark; autoplay was refused, and the cover is
 *           click-through so pressing it lands on the embed underneath, which
 *           is the in-frame gesture Safari insists on
 * playing — cover gone, the player owns the screen
 * paused  — the visitor paused it in YouTube's own controls; nothing of ours
 *           comes over the top
 * ended   — black again, on the way out
 */
type Phase = "cueing" | "prompt" | "playing" | "paused" | "ended";

/** The embed we currently have mounted. */
type Frame = {
    id: string;
    /**
     * Fixed for the life of the frame. Changing an iframe's `src` renavigates
     * it, which would throw away exactly the work standby did.
     */
    src: string;
    /** Built on standby: autoplay off, so opening it is a command, not a load. */
    armed: boolean;
};

/**
 * The picture *and* YouTube's own controls. We used to hide them and put our
 * own pause on top, which cost the visitor everything the real control bar does
 * — scrubbing most of all, and the logo that opens the video on YouTube. The
 * overlay's job is to give the reel the whole screen and get out of the way.
 *
 * `enablejsapi` buys us the embed's status channel and the two commands we send
 * back over it. `modestbranding` and `color` are absent because YouTube stopped
 * honouring both — the progress bar is red whatever we ask for. On standby,
 * `autoplay` is off: the frame loads, and stays dark and silent until someone
 * actually asks for the reel.
 */
function embedSrc(videoId: string, standby: boolean): string {
    const params = new URLSearchParams({
        autoplay: standby ? "0" : "1",
        playsinline: "1",
        rel: "0",
        iv_load_policy: "3",
        enablejsapi: "1",
        origin: window.location.origin,
    });
    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

/**
 * The one player on the site, mounted once at the root and driven by
 * `lib/reel`. Any button anywhere calls `openReel(video)`; this fades a
 * full-screen frame over everything and hands the screen to the picture.
 *
 * It is also mounted, invisible and inert, whenever `lib/reel` has a reel on
 * standby — which is how the click that opens a reel has nothing left to load.
 *
 * It portals to `document.body` on purpose: the scene layers are clipped
 * (`clip-path`) and contained (`contain: strict`), either of which would trap
 * a fixed overlay inside the hero.
 */
export function ReelPlayer() {
    const requested = useReel();
    const warm = useWarmReel();
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
    const frame = useRef<Frame | null>(null);
    // what to put back on standby once the overlay is gone
    const lastOpened = useRef<Video | null>(null);

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
            // a standby frame is already loaded; only a brand new one starts over
            const fresh = frame.current?.id !== requested.videoId;

            returnFocus.current = document.activeElement as HTMLElement | null;
            lastOpened.current = requested;
            setShowing(requested);
            if (fresh) setLoaded(false);
            setPhase("cueing");
            setSettled(false);
            heard.current = false;
            // next frame, so the enter transition has a "from" state to run from
            const raf = requestAnimationFrame(() => setOpen(true));
            return () => cancelAnimationFrame(raf);
        }

        setOpen(false);
        // cut the sound with the picture instead of letting it play out the fade.
        // Unmounting the frame below is what actually stops it.
        command("pauseVideo");

        const closed = lastOpened.current;
        const exit = window.setTimeout(() => {
            setShowing(null);
            // back to standby: the frame that reports its last state is gone
            setPhase("cueing");
        }, EXIT_MS);
        // the embed is in the browser cache now, so getting back to standby is
        // nearly free — and it makes a second look as instant as the first
        const rewarm = window.setTimeout(() => {
            if (closed) warmReel(closed);
        }, EXIT_MS + REWARM_MS);

        return () => {
            window.clearTimeout(exit);
            window.clearTimeout(rewarm);
        };
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

    // our chrome sits up for a beat, then settles into the film. It never leaves —
    // reaching for the close brings it back.
    useEffect(() => {
        if (!showing) return;
        const timer = window.setTimeout(() => setSettled(true), SETTLE_MS);
        return () => window.clearTimeout(timer);
    }, [showing]);

    // The picture normally arrives on the embed's own PLAYING message. If that
    // hasn't come a beat after load, autoplay was refused — ask for the press
    // if the channel is talking to us, and if it never was, just uncover and
    // let the embed speak for itself. A standby frame gets a much shorter rope:
    // it is already up, so the play command either takes at once or not at all.
    useEffect(() => {
        if (!showing || phase !== "cueing") return;

        const wait = !loaded
            ? REVEAL_CEILING_MS
            : frame.current?.armed
              ? WARM_REVEAL_MS
              : REVEAL_MS;

        const timer = window.setTimeout(
            () => setPhase(heard.current ? "prompt" : "playing"),
            wait,
        );
        return () => window.clearTimeout(timer);
    }, [showing, loaded, phase]);

    // Talk the embed's own message channel instead of pulling in the IFrame API
    // script: post "listening" until the player answers, then read its state off
    // the replies. That state is what tells us when there is a real picture to
    // uncover. If it never answers, the timers above uncover it anyway.
    useEffect(() => {
        if (!showing || !open) return;

        let endTimer = 0;
        let ping = 0;
        let tries = 0;

        function onMessage(event: MessageEvent) {
            if (!YT_ORIGINS.includes(event.origin)) return;

            let data: unknown;
            try {
                data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
            } catch {
                return;
            }

            heard.current = true;

            const info = (data as { info?: unknown }).info;
            const state =
                typeof info === "number"
                    ? info
                    : (info as { playerState?: number } | undefined)?.playerState;

            if (state === PLAYING) {
                setPhase("playing");
                window.clearInterval(ping);
            }
            if (state === PAUSED) setPhase("paused");
            if (state === ENDED) {
                // cut to black on the last frame rather than letting YouTube's
                // end screen show, then take the frame away
                setPhase("ended");
                window.clearInterval(ping);
                endTimer = window.setTimeout(closeReel, ENDED_MS);
            }
        }

        window.addEventListener("message", onMessage);

        // The embed ignores us until its player is up, so keep asking — and keep
        // asking it to play: a standby frame was loaded with autoplay off, so the
        // command *is* the press. It's a no-op on a frame already running.
        function poke() {
            frameRef.current?.contentWindow?.postMessage(
                JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
                "*",
            );
            command("playVideo");
        }

        poke();
        ping = window.setInterval(() => {
            tries += 1;
            if (tries > PING_LIMIT) {
                window.clearInterval(ping);
                return;
            }
            poke();
        }, PING_MS);

        return () => {
            window.removeEventListener("message", onMessage);
            window.clearInterval(ping);
            window.clearTimeout(endTimer);
        };
    }, [showing, open]);

    if (!mounted) return null;

    // Showing wins; otherwise this is the standby frame, loading behind an
    // invisible overlay.
    const target = showing ?? warm;
    if (!target) {
        // the embed is gone, so the next one starts from scratch
        frame.current = null;
        return null;
    }

    // memo-by-key, in render on purpose: the src has to exist before the iframe
    // does, and it has to survive the standby → open transition untouched
    if (frame.current?.id !== target.videoId) {
        frame.current = {
            id: target.videoId,
            src: embedSrc(target.videoId, !showing),
            armed: !showing,
        };
    }

    return createPortal(
        <div
            ref={overlayRef}
            className={`${monoFont.className} reel-overlay ${open ? "is-open" : ""} ${
                settled ? "is-settled" : ""
            }`}
            data-phase={phase}
            // On standby this is a full-viewport, invisible overlay holding a
            // live iframe. `inert` is what keeps it out of the tab order and out
            // of hit-testing; opacity alone would leave the embed focusable.
            inert={!showing}
            aria-hidden={showing ? undefined : true}
            role={showing ? "dialog" : undefined}
            aria-modal={showing ? true : undefined}
            aria-label={showing ? showing.title : undefined}
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

                <iframe
                    key={frame.current.id}
                    ref={frameRef}
                    className="reel-player"
                    src={frame.current.src}
                    title={target.title}
                    allow={YT_ALLOW}
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    onLoad={() => setLoaded(true)}
                />

                {/* Our own black over the embed until it is genuinely playing, so
                    YouTube's unstarted title bar never shows. It blocks clicks
                    while cueing and turns click-through while prompting, so the
                    press lands on the embed underneath. */}
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
                </span>
            </div>

            <button type="button" ref={closeRef} className="reel-close" onClick={closeReel}>
                <span className="reel-close-label">CLOSE</span>
                <span className="reel-close-mark" aria-hidden="true" />
            </button>
        </div>,
        document.body,
    );
}

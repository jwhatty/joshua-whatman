import type { ReactNode } from "react";

export type Video = {
    videoId: string;
    title: string;
    thumbnail?: string;
    /** Runtime shown on the poster, e.g. "01:24" — clicking feels bounded. */
    duration?: string;
};

export type Category = {
    id: string;
    enabled: boolean;
    label: string;
    /** Layer background. */
    color: string;
    /** Layer foreground, and the nav/logo colour while this scene is on top. */
    fg: string;
    /** YouTube id of the headline reel. */
    main: string;
    mainTitle: string;
    mainThumbnail?: string;
    mainDuration?: string;
    extras: Video[];
};

/** One full-screen scene in the stack. `render` gets whether it is the active scene. */
export type Section = {
    id: string;
    bg: string;
    fg: string;
    render: (active: boolean) => ReactNode;
};

export type YouTubePlayer = {
    pauseVideo: () => void;
    seekTo: (seconds: number, allowSeekAhead: boolean) => void;
    destroy: () => void;
};

declare global {
    interface Window {
        YT?: {
            Player: new (
                element: Element,
                options: { events?: { onReady?: () => void } },
            ) => YouTubePlayer;
        };
        onYouTubeIframeAPIReady?: () => void;
    }
}

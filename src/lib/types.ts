import type { ReactNode } from "react";

export type Video = {
    videoId: string;
    title: string;
    thumbnail?: string;
    /** Runtime shown on the poster and in the cue list, e.g. "01:24". */
    duration?: string;
    /** Optional year tag shown in the cue list. */
    year?: string;
};

export type Category = {
    id: string;
    enabled: boolean;
    label: string;
    /** Layer background. */
    color: string;
    /** Layer foreground, and the nav/logo colour while this scene is on top. */
    fg: string;
    /** Newest first. The first cue loads into the monitor by default. */
    videos: Video[];
};

/** One full-screen scene in the stack. `render` gets whether it is the active scene. */
export type Section = {
    id: string;
    bg: string;
    fg: string;
    render: (active: boolean) => ReactNode;
};


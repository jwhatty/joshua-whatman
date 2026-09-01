import type { Category, Video } from "@/lib/types";

// flip these to turn sections on/off
const SHOW_SOUND_DESIGN = true;
const SHOW_COMPOSITION = false;
const SHOW_AUDIO_EDITING = false;

export const INK = "#0a0a0a";
export const CREAM = "#f4efe0";
export const ABOUT_BG = "#000000";
export const CONTACT_BG = "#0a0a0a";
export const CONTACT_FG = "#fafafa";

export const heroReel: Video = {
    videoId: "MAIN_REEL",
    title: "Demo reel",
    // placeholder like the videoId — set from the real reel when it exists
    duration: "01:24",
};

export const categories: Category[] = [
    {
        id: "sound-design",
        enabled: SHOW_SOUND_DESIGN,
        label: "Sound Design",
        color: CREAM,
        fg: INK,
        main: "t-uK94HaxeM",
        mainTitle: "Sound Redesign • Into The Spider-Verse",
        mainThumbnail: "/thumbnails/sdthumbnail1.png",
        extras: [
            { title: "Design Reel 2", videoId: "SOUND_REEL_2" },
            { title: "Design Reel 3", videoId: "SOUND_REEL_3" },
        ],
    },
    {
        id: "composition",
        enabled: SHOW_COMPOSITION,
        label: "Music Composition",
        color: INK,
        fg: CREAM,
        main: "MUSIC_REEL",
        mainTitle: "Main reel title here",
        extras: [
            { title: "Piece 2", videoId: "MUSIC_REEL_2" },
            { title: "Piece 3", videoId: "MUSIC_REEL_3" },
        ],
    },
    {
        id: "audio-editing",
        enabled: SHOW_AUDIO_EDITING,
        label: "Audio Editing",
        color: CREAM,
        fg: INK,
        main: "EDITING_REEL",
        mainTitle: "Main reel title here",
        extras: [
            { title: "Piece Two", videoId: "EDITING_REEL_2" },
            { title: "Piece Three", videoId: "EDITING_REEL_3" },
        ],
    },
];

/** Only the categories flipped on above. */
export const visibleCategories = categories.filter((category) => category.enabled);

/** Scene order top to bottom — drives ScrollHint's "what comes next". */
export const sectionOrder: string[] = [
    "hero",
    ...visibleCategories.map((category) => category.id),
    "about",
    "contact",
];

/** Logo/nav colour per scene, falling back to cream. */
export const sectionLogoColors: Record<string, string> = {
    hero: CREAM,
    about: CREAM,
    contact: CREAM,
    ...Object.fromEntries(visibleCategories.map((category) => [category.id, category.fg])),
};

export const navItems = [
    ...visibleCategories.map((category) => ({ id: category.id, label: category.label })),
    { id: "about", label: "About" },
    { id: "contact", label: "Contact" },
];

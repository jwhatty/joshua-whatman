import { useState } from "react";
import { VideoFrame } from "@/components/VideoFrame";
import { sectionOrder } from "@/lib/data";
import { displayFont, monoFont } from "@/lib/fonts";
import { soundEngine } from "@/lib/sound";
import type { Category } from "@/lib/types";

type WorkSectionProps = {
    category: Category;
    active: boolean;
};

/**
 * One category as a studio deck: a single monitor on the left, and the cue
 * list — every piece, newest first — on the right. Loading a cue swaps the
 * monitor and plays; there is exactly one player per category, however many
 * videos the list grows to. On small screens the list stacks under the
 * monitor, replacing the old carousel.
 */
export function WorkSection({ category, active }: WorkSectionProps) {
    const [selected, setSelected] = useState(0);
    // false until the visitor picks a cue; from then on, loads auto-play
    const [engaged, setEngaged] = useState(false);

    // leaving the scene racks the deck back to the top cue, poster showing
    const [wasActive, setWasActive] = useState(active);
    if (wasActive !== active) {
        setWasActive(active);
        if (!active) {
            setSelected(0);
            setEngaged(false);
        }
    }

    const videos = category.videos;
    const current = videos[selected];

    // this section's scroll index — hero is 00, matching nav, slate and timecode
    const sceneNumber = String(Math.max(0, sectionOrder.indexOf(category.id))).padStart(2, "0");

    function loadCue(index: number) {
        if (index === selected && engaged) return;
        setSelected(index);
        setEngaged(true);
        soundEngine.tick();
    }

    return (
        <div className="work-inner">
            <span className={`${displayFont.className} work-ghost-index`} aria-hidden="true">
                {sceneNumber}
            </span>

            <div className="work-heading">
                <h2 className={`${displayFont.className} work-title`}>{category.label}</h2>
            </div>

            <div className="work-deck">
                <div className="work-monitor">
                    {/* keyed by cue position, not video id — ids can repeat
                        while placeholders share one video */}
                    <VideoFrame
                        key={`${selected}-${engaged}`}
                        videoId={current.videoId}
                        title={current.title}
                        thumbnail={current.thumbnail}
                        duration={current.duration}
                        autoPlay={engaged}
                        active={active}
                    />
                    <p className={`${monoFont.className} work-caption`}>{current.title}</p>
                </div>

                <div className={`${monoFont.className} cue-list`}>
                    <p className="cue-list-head">Cues · newest first</p>

                    {videos.map((video, i) => (
                        <button
                            key={i}
                            type="button"
                            className={`cue-row ${i === selected ? "cue-row-active" : ""}`}
                            onClick={() => loadCue(i)}
                            onMouseEnter={() => soundEngine.tick()}
                            aria-pressed={i === selected}
                        >
                            <span className="cue-index">{String(i + 1).padStart(2, "0")}</span>
                            <span className="cue-title">{video.title}</span>
                            <span className="cue-meta">
                                {[video.year, video.duration].filter(Boolean).join(" · ")}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

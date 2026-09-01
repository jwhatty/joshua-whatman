import { VideoFrame } from "@/components/VideoFrame";
import { monoFont } from "@/lib/fonts";

type WorkCardProps = {
    videoId: string;
    title: string;
    thumbnail?: string;
    duration?: string;
    className?: string;
    active?: boolean;
};

/** One video plus its caption — used for every reel on the page. */
export function WorkCard({
    videoId,
    title,
    thumbnail,
    duration,
    className = "",
    active,
}: WorkCardProps) {
    return (
        <div className={`work-card ${className}`}>
            <VideoFrame
                videoId={videoId}
                title={title}
                thumbnail={thumbnail}
                duration={duration}
                active={active}
            />
            <p className={`${monoFont.className} work-caption`}>{title}</p>
        </div>
    );
}

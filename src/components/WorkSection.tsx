import { useRef, useState } from "react";
import { WorkCard } from "@/components/WorkCard";
import { displayFont, monoFont } from "@/lib/fonts";
import type { Category } from "@/lib/types";

type WorkSectionProps = {
    category: Category;
    active: boolean;
};

/** One category: its headline reel plus a swipeable carousel of extras. */
export function WorkSection({ category, active }: WorkSectionProps) {
    const carouselRef = useRef<HTMLDivElement>(null);
    const [slideIndex, setSlideIndex] = useState(0);
    const totalSlides = 1 + category.extras.length;

    // Which slide is closest to the current scroll position — keeps the counter in
    // sync when swiping on mobile, not just when clicking the arrows.
    function syncIndex(carousel: HTMLDivElement) {
        const slides = Array.from(carousel.querySelectorAll<HTMLElement>(".work-card"));
        if (!slides.length) return;

        let closest = 0;
        let closestDistance = Infinity;

        slides.forEach((slide, i) => {
            const distance = Math.abs(slide.offsetLeft - carousel.scrollLeft);
            if (distance < closestDistance) {
                closestDistance = distance;
                closest = i;
            }
        });

        setSlideIndex(closest);
    }

    function goTo(index: number) {
        const carousel = carouselRef.current;
        const slide = carousel?.querySelectorAll<HTMLElement>(".work-card")[index];
        if (!carousel || !slide) return;

        carousel.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
        setSlideIndex(index);
    }

    return (
        <div className="work-inner">
            <div className="work-heading">
                <h2 className={`${displayFont.className} work-title`}>{category.label}</h2>
            </div>

            <div className="work-carousel-shell">
                <div
                    ref={carouselRef}
                    className="work-grid"
                    onScroll={(event) => syncIndex(event.currentTarget)}
                >
                    <WorkCard
                        videoId={category.main}
                        title={category.mainTitle}
                        thumbnail={category.mainThumbnail}
                        className="work-main"
                        active={active}
                    />

                    <div className="work-extras">
                        {category.extras.map((video) => (
                            <WorkCard
                                key={video.videoId}
                                videoId={video.videoId}
                                title={video.title}
                                className="work-extra"
                                active={active}
                            />
                        ))}
                    </div>
                </div>

                {totalSlides > 1 && (
                    <div
                        className={`${monoFont.className} work-carousel-controls`}
                        aria-label="Work carousel navigation"
                    >
                        <button
                            type="button"
                            className="work-carousel-arrow"
                            onClick={() => goTo(Math.max(slideIndex - 1, 0))}
                            disabled={slideIndex === 0}
                            aria-label="Previous work"
                        >
                            ←
                        </button>

                        <span className="work-carousel-count">
                            {String(slideIndex + 1).padStart(2, "0")} /{" "}
                            {String(totalSlides).padStart(2, "0")}
                        </span>

                        <button
                            type="button"
                            className="work-carousel-arrow"
                            onClick={() => goTo(Math.min(slideIndex + 1, totalSlides - 1))}
                            disabled={slideIndex === totalSlides - 1}
                            aria-label="Next work"
                        >
                            →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

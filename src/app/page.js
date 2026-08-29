"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Anton, Archivo, JetBrains_Mono } from "next/font/google";

const display = Anton({ subsets: ["latin"], weight: "400" });
const body = Archivo({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"] });

// flip these to turn sections on/off
const SHOW_SOUND_DESIGN = true;
const SHOW_COMPOSITION = false;
const SHOW_AUDIO_EDITING = false;

const INK = "#0a0a0a";
const CREAM = "#f4efe0";

// clamp a number between min/max for all the scroll math
function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}
// hero data
const heroReel = {
    videoId: "MAIN_REEL",
    title: "Demo reel",
};
// category data
const categories = [
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

// only keep the ones flipped on above
const visibleCategories = [];
for (const cat of categories) {
    if (cat.enabled) visibleCategories.push(cat);
}

// section colors
const SECTION_LOGO_COLORS = { hero: CREAM, about: CREAM, contact: CREAM };
for (const cat of visibleCategories) {
    SECTION_LOGO_COLORS[cat.id] = cat.fg;
}
// youtube perms
const YT_ALLOW =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

// youtube embed/video frame/thumbnails
function VideoFrame({ videoId, title, thumbnail, active: isActive = true }) {
    const frameRef = useRef(null);
    const playerRef = useRef(null);
    const [started, setStarted] = useState(false);

    // the sections in this page don't actually unmount when scrolled off, they get hidden. This extra effect catches that case
    useEffect(() => {
        if (!isActive) setStarted(false);
    }, [isActive]);

    useEffect(() => {
        if (!started || !frameRef.current) return;

        let observer;

        function setupObserver() {
            // frameRef wraps the iframe, need to grab the actual node
            const iframe = frameRef.current ? frameRef.current.querySelector("iframe") : null;
            if (!iframe) return;

            observer = new IntersectionObserver(
                (entries) => {
                    const entry = entries[0];
                    if (entry.isIntersecting) return;
                    // scrolled out of view - stop and reset
                    if (playerRef.current) {
                        playerRef.current.pauseVideo();
                        playerRef.current.seekTo(0, false);
                    }
                    setStarted(false);
                },
                { threshold: 0.1 }
            );

            observer.observe(frameRef.current);
        }

        if (window.YT && window.YT.Player) {
            playerRef.current = new window.YT.Player(frameRef.current.querySelector("iframe"), {
                events: { onReady: setupObserver },
            });
        } else {
            // script only needs to be added once, other VideoFrames can reuse it
            const scriptId = "youtube-iframe-api";
            let script = document.getElementById(scriptId);

            if (!script) {
                script = document.createElement("script");
                script.id = scriptId;
                script.src = "https://www.youtube.com/iframe_api";
                document.body.appendChild(script);
            }
            const previousReady = window.onYouTubeIframeAPIReady;

            window.onYouTubeIframeAPIReady = () => {
                if (previousReady) previousReady();
                if (!frameRef.current) return;

                playerRef.current = new window.YT.Player(frameRef.current.querySelector("iframe"), {
                    events: { onReady: setupObserver },
                });
            };
        }

        return () => {
            if (observer) observer.disconnect();
            if (playerRef.current) {
                playerRef.current.destroy();
                playerRef.current = null;
            }
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
                    <span className={`${mono.className} video-title`}>{title}</span>
                </button>
            )}
        </div>
    );
}

// smooth-scroll to a section by id
function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// nav header, shows enabled categories and default pages
function NavBar({ activeId }) {
    const items = [];
    for (const cat of visibleCategories) {
        items.push({ id: cat.id, label: cat.label });
    }
    items.push({ id: "about", label: "About" });
    items.push({ id: "contact", label: "Contact" });

    const [visible, setVisible] = useState(false);

    // only show the floating nav below the hero
    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.45);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    // fall back to cream if nothing set
    let sectionColor = SECTION_LOGO_COLORS[activeId];
    if (!sectionColor) sectionColor = CREAM;

    return (
        <header className={`site-header ${visible ? "site-header-visible" : ""}`}>
            <button
                type="button"
                className="site-logo-button"
                onClick={() => scrollToId("hero")}
                aria-label="Go to home"
            >
                <span className="site-logo-mark" style={{ backgroundColor: sectionColor }} />
            </button>

            <nav className={`${mono.className} site-nav`} style={{ color: sectionColor }}>
                {items.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        className={activeId === item.id ? "site-nav-item active" : "site-nav-item"}
                        onClick={() => scrollToId(item.id)}
                    >
                        {item.label}
                    </button>
                ))}
            </nav>
        </header>
    );
}

// scroll down hint/arrow

function ScrollHint({ activeId }) {
    const { scrollY } = useScroll();
    const topOpacity = useTransform(scrollY, [0, 80], [1, 0]);
    const bottomOpacity = useTransform(scrollY, [40, 140], [0, 1]);

    const order = ["hero"];
    for (const cat of visibleCategories) {
        order.push(cat.id);
    }
    order.push("about", "contact");

    const currentIndex = order.indexOf(activeId);

    // whatever comes right after the current section, or null at end
    let nextId = null;
    if (currentIndex >= 0 && currentIndex < order.length - 1) {
        nextId = order[currentIndex + 1];
    }

    function handleClick() {
        if (nextId) scrollToId(nextId);
    }

    return (
        <>
            <motion.button
                type="button"
                className={`${mono.className} hero-scroll-cue-initial`}
                style={{ opacity: topOpacity }}
                onClick={handleClick}
                aria-label={nextId ? `Scroll to ${nextId}` : "Scroll down"}
                disabled={!nextId}
            >
                <span className="hero-scroll-label">SELECTED WORKS</span>
                <span className="hero-scroll-arrow">↓</span>
            </motion.button>

            {nextId && (
                <motion.button
                    type="button"
                    className={`${mono.className} hero-scroll-cue-bottom`}
                    style={{ opacity: bottomOpacity }}
                    onClick={handleClick}
                    aria-label={`Scroll to ${nextId}`}
                >
                    <span className="hero-scroll-arrow">↓</span>
                </motion.button>
            )}
        </>
    );
}

// Scenes and Scrolling logic

// colored full-screen div, logic is in SceneStack
function Layer({ bg, fg, transition, children, layerRef }) {
    return (
        <div ref={layerRef} className={`scene-layer scene-layer-${transition}`} style={{ background: bg, color: fg }}>
            {children}
        </div>
    );
}

// turns scroll position into "which section is on top" and animates the wipe between them
function SceneStack({ sections, onActiveChange }) {
    const layers = useRef([]);
    const vh = useRef(0); // viewport height, cached so we're not reading it every scroll frame
    // current state: active layer, incoming layer, locked
    const scene = useRef({ base: -1, incoming: -1, locked: -1 });

    useEffect(() => {
        function onResize() {
            vh.current = window.innerHeight;
        }
        onResize();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        // hide/show toggles the css for that layer
        function hide(layer) {
            if (!layer) return;
            layer.style.visibility = "hidden";
            layer.style.opacity = "0";
            layer.style.zIndex = "0";
            layer.style.pointerEvents = "none";
            layer.style.setProperty("--scene-inset", "50%");
        }

        function show(layer) {
            if (!layer) return;
            layer.style.visibility = "visible";
            layer.style.opacity = "1";
            layer.style.zIndex = "2";
            layer.style.pointerEvents = "auto";
            layer.style.setProperty("--scene-inset", "0%");
        }

        function update() {
            const height = vh.current;
            const total = sections.length;
            if (!height || !total) return;

            const scroll = window.scrollY;
            const position = scroll / height;


            const nearest = clamp(Math.round(position), 0, total - 1);
            const dist = Math.abs(scroll - nearest * height);

            // few pixels to account for trackpad/magic mouse weird shit
            if (dist <= 6) {
                const nearestSection = sections[nearest];
                if (nearestSection) onActiveChange(nearestSection.id);

                if (scene.current.locked !== nearest) {
                    // show active, hide everything else
                    for (let i = 0; i < layers.current.length; i++) {
                        if (i === nearest) show(layers.current[i]);
                        else hide(layers.current[i]);
                    }
                    scene.current = { base: nearest, incoming: -1, locked: nearest };
                }
                return;
            }

            const base = clamp(Math.floor(position), 0, total - 1);
            const progress = clamp(position - base, 0, 1);
            const incoming = base + 1;
            const hasNext = incoming < total;

            const active = clamp(Math.round(position), 0, total - 1);
            const activeSection = sections[active];
            if (activeSection) onActiveChange(activeSection.id);

            // base layer changed since last frame, or state was just unlocked
            if (scene.current.base !== base || scene.current.locked !== -1) {
                for (let i = 0; i < layers.current.length; i++) {
                    const layer = layers.current[i];
                    if (i === base) {
                        show(layer);
                    } else if (hasNext && i === incoming) {
                        // getting this one ready for the wipe below
                        layer.style.visibility = "visible";
                        layer.style.opacity = "1";
                        layer.style.zIndex = "3";
                        layer.style.pointerEvents = "none";
                    } else {
                        // has to be fully hidden here, not just behind. "lets work" text was bleeding thru
                        hide(layer);
                    }
                }

                // if there's nothing next
                let incomingIndex = -1;
                if (hasNext) incomingIndex = incoming;
                scene.current = { base, incoming: incomingIndex, locked: -1 };
            }

            if (!hasNext) return;

            const nextLayer = layers.current[incoming];
            if (!nextLayer) return;

            // alternate the wipe direction
            const shutter = base % 2 === 0;
            const inset = (1 - progress) * 50;

            // page clickable when almost done wipe
            let clickable = "none";
            if (inset < 4) clickable = "auto";

            // flip wipe direction
            let direction = "door";
            if (shutter) direction = "shutter";

            nextLayer.style.visibility = "visible";
            nextLayer.style.opacity = "1";
            nextLayer.style.zIndex = "3";
            nextLayer.style.pointerEvents = clickable;
            nextLayer.style.setProperty("--scene-inset", `${inset}%`);
            nextLayer.dataset.transitionDirection = direction;
        }

        // rAF-throttle scroll handler
        let raf = null;
        const onScroll = () => {
            if (raf !== null) return;
            raf = requestAnimationFrame(() => {
                raf = null;
                update();
            });
        };

        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", update);

        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", update);
            if (raf !== null) cancelAnimationFrame(raf);
        };
    }, [sections, onActiveChange]);

    return (
        <div className="scene-track" style={{ height: `${sections.length * 100}vh` }}>
            <div className="scene-frame">
                {sections.map((section, i) => {
                    // alternate wipe style: shutter/door
                    let wipeStyle = "door";
                    if (i % 2 !== 0) wipeStyle = "shutter";

                    return (
                        <Layer
                            key={section.id}
                            bg={section.bg}
                            fg={section.fg}
                            transition={wipeStyle}
                            layerRef={(el) => {
                                layers.current[i] = el;
                            }}
                        >
                            {section.content}
                        </Layer>
                    );
                })}
            </div>

            {/* invisible markers so getElementById/scrollIntoView still work for nav clicks */}
            <div className="scene-markers">
                {sections.map((section) => (
                    <div key={section.id} id={section.id} className="scene-marker" />
                ))}
            </div>
        </div>
    );
}

// landing section - name, tagline, and the big demo reel
function Hero({ active }) {
    // fall back to "about" if every work category is off
    const firstCategory = visibleCategories[0];
    const firstCategoryId = firstCategory ? firstCategory.id : "about";

    function scrollToWork() {
        scrollToId(firstCategoryId);
    }

    return (
        <div className="hero-inner">
            <div className="hero-copy">
                <div className="hero-title-row">
                    <div className="hero-name-row">
                        <div className="hero-logo" aria-hidden="true">
                            <span className="hero-logo-mark" />
                        </div>

                        <h1 className={`${display.className} hero-title`}>
                            JOSHUA
                            <br />
                            WHATMAN
                        </h1>
                    </div>

                    <div className="hero-title-block">
                        <p className={`${mono.className} hero-eyebrow`}>SOUND DESIGNER • DIGITAL MEDIA</p>

                        <div className="hero-scroll-cue-slot">
                            <button
                                type="button"
                                className={`${mono.className} hero-scroll-cue-static`}
                                onClick={scrollToWork}
                                aria-label="Scroll to selected work"
                            >
                                <span>SELECTED WORKS</span>
                                <span className="hero-scroll-arrow">↓</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="hero-reel">
                <VideoFrame videoId={heroReel.videoId} title={heroReel.title} active={active} />
                <p className={`${mono.className} hero-reel-caption`}>{heroReel.title}</p>

                <button
                    type="button"
                    className={`${mono.className} hero-scroll-cue-mobile`}
                    onClick={scrollToWork}
                    aria-label="Scroll to selected work"
                >
                    <span>SELECTED WORKS</span>
                    <span className="hero-scroll-arrow">↓</span>
                </button>
            </div>
        </div>
    );
}

// one video and caption, used for all reels
function WorkCard({ videoId, title, thumbnail, className = "", active: isActive }) {
    return (
        <div className={`work-card ${className}`}>
            <VideoFrame videoId={videoId} title={title} thumbnail={thumbnail} active={isActive} />
            <p className={`${mono.className} work-caption`}>{title}</p>
        </div>
    );
}

// category demo reels/carousel
function WorkSection({ category, active }) {
    const carouselRef = useRef(null);
    const [slideIndex, setSlideIndex] = useState(0);
    const totalSlides = 1 + category.extras.length;

    // figure out which slide is closest to the current scroll position -
    // this way swiping on mobile keeps the counter in sync too, not just
    // clicking the arrow buttons
    function syncIndex() {
        const carousel = carouselRef.current;
        if (!carousel) return;

        const slides = Array.from(carousel.querySelectorAll(".work-card"));
        if (!slides.length) return;

        let closest = 0;
        let closestDist = Infinity;

        slides.forEach((slide, i) => {
            const dist = Math.abs(slide.offsetLeft - carousel.scrollLeft);
            if (dist < closestDist) {
                closestDist = dist;
                closest = i;
            }
        });

        setSlideIndex(closest);
    }

    useEffect(() => {
        const carousel = carouselRef.current;
        if (!carousel) return;
        carousel.addEventListener("scroll", syncIndex, { passive: true });
        return () => carousel.removeEventListener("scroll", syncIndex);
    }, []);

    function goTo(index) {
        const carousel = carouselRef.current;
        if (!carousel) return;

        const slide = carousel.querySelectorAll(".work-card")[index];
        if (!slide) return;

        carousel.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
        setSlideIndex(index);
    }

    return (
        <div className="work-inner">
            <div className="work-heading">
                <h2 className={`${display.className} work-title`}>{category.label}</h2>
            </div>

            <div className="work-carousel-shell">
                <div ref={carouselRef} className="work-grid">
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
                    <div className={`${mono.className} work-carousel-controls`} aria-label="Work carousel navigation">
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
              {String(slideIndex + 1).padStart(2, "0")} / {String(totalSlides).padStart(2, "0")}
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

// bio section with background photo
function About() {
    return (
        <div className="about-inner">
            <div className="about-bg">
                <img
                    src="/studio.jpg"
                    alt="Joshua Whatman producing music at a computer in his recording studio as Spencer Lee plays bass behind him."
                />
            </div>

            <div className="about-content">
                <h2 className={`${display.className} about-title`}>About Me</h2>

                <div className="about-copy">
                    <p className="about-lead">
                        Sound Designer, Music Producer - Victoria, BC
                    </p>

                    <p>
                        I’ve worked in audio for more than 15 years, across music production,
                        studio recording, audio post, radio, concert production, live recording, and more.
                        That range of experience, along with my (at times, unsettling) passion for this craft
                        has given me a deep and practical understanding of sound and audio
                        production, informing every detail in my work today.
                    </p>

                    <p>Audio can make or break a project. If you need someone who will obsess over every detail of your project, I'm your guy.</p>
                </div>
            </div>
        </div>
    );
}

// contact slide
function Contact() {
    return (
        <div className="contact-inner">
            <h2 className={`${display.className} contact-line`}>LET’S WORK.</h2>

            <a href="mailto:contact@joshuawhatman.com" className={`${mono.className} contact-link`}>
                contact@joshuawhatman.com
            </a>

            <div className={`${mono.className} contact-credit`}>
                © 2026 Joshua Whatman
                <br />
                Photography: JazzPizza
            </div>
        </div>
    );
}

const ABOUT_BG = "#000000";
const CONTACT_BG = "#0a0a0a";

// build section list (hero, each category, about, contact) and render
export default function Home() {
    const [activeId, setActiveId] = useState("hero");

    const sections = [{ id: "hero", bg: INK, fg: CREAM, content: <Hero active={activeId === "hero"} /> }];

    for (const category of visibleCategories) {
        sections.push({
            id: category.id,
            bg: category.color,
            fg: category.fg,
            content: <WorkSection category={category} active={activeId === category.id} />,
        });
    }

    sections.push({ id: "about", bg: ABOUT_BG, fg: CREAM, content: <About /> });
    sections.push({ id: "contact", bg: CONTACT_BG, fg: "#fafafa", content: <Contact /> });

    return (
        <main className={`${body.className} site`}>
            <NavBar activeId={activeId} />
            <SceneStack sections={sections} onActiveChange={setActiveId} />
            <ScrollHint activeId={activeId} />
        </main>
    );
}
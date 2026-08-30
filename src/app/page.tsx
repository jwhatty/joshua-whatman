"use client";

import { useState } from "react";
import { About } from "@/components/About";
import { Contact } from "@/components/Contact";
import { Hero } from "@/components/Hero";
import { NavBar } from "@/components/NavBar";
import { SceneStack } from "@/components/SceneStack";
import { ScrollHint } from "@/components/ScrollHint";
import { WorkSection } from "@/components/WorkSection";
import { ABOUT_BG, CONTACT_BG, CONTACT_FG, CREAM, INK, visibleCategories } from "@/lib/data";
import { bodyFont } from "@/lib/fonts";
import type { Section } from "@/lib/types";

// Hero, one scene per enabled category, then about and contact. Built once at module
// scope so SceneStack's scroll listener isn't torn down on every active-section change.
const sections: Section[] = [
    { id: "hero", bg: INK, fg: CREAM, render: (active) => <Hero active={active} /> },
    ...visibleCategories.map((category) => ({
        id: category.id,
        bg: category.color,
        fg: category.fg,
        render: (active: boolean) => <WorkSection category={category} active={active} />,
    })),
    { id: "about", bg: ABOUT_BG, fg: CREAM, render: () => <About /> },
    { id: "contact", bg: CONTACT_BG, fg: CONTACT_FG, render: () => <Contact /> },
];

export default function Home() {
    const [activeId, setActiveId] = useState("hero");

    return (
        <main className={`${bodyFont.className} site`}>
            <NavBar activeId={activeId} />
            <SceneStack sections={sections} activeId={activeId} onActiveChange={setActiveId} />
            <ScrollHint activeId={activeId} />
        </main>
    );
}

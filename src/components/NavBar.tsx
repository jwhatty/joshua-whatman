import { useEffect, useState } from "react";
import { CREAM, navItems, sectionLogoColors } from "@/lib/data";
import { monoFont } from "@/lib/fonts";
import { scrollToId } from "@/lib/utils";

/** True once the page is scrolled past `fraction` of a viewport height. */
function useScrolledPast(fraction: number): boolean {
    const [scrolledPast, setScrolledPast] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolledPast(window.scrollY > window.innerHeight * fraction);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [fraction]);

    return scrolledPast;
}

/** Floating header: logo plus the enabled categories and the fixed pages. */
export function NavBar({ activeId }: { activeId: string }) {
    // only show the floating nav below the hero
    const visible = useScrolledPast(0.45);
    const sectionColor = sectionLogoColors[activeId] ?? CREAM;

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

            <nav className={`${monoFont.className} site-nav`} style={{ color: sectionColor }}>
                {navItems.map((item) => (
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

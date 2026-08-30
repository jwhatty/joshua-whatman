import { displayFont, monoFont } from "@/lib/fonts";

/** Closing scene — the call to action and the credits. */
export function Contact() {
    return (
        <div className="contact-inner">
            <h2 className={`${displayFont.className} contact-line`}>LET’S WORK.</h2>

            <a
                href="mailto:contact@joshuawhatman.com"
                className={`${monoFont.className} contact-link`}
            >
                contact@joshuawhatman.com
            </a>

            <div className={`${monoFont.className} contact-credit`}>
                © 2026 Joshua Whatman
                <br />
                Photography: JazzPizza
            </div>
        </div>
    );
}

/**
 * The down arrow, drawn rather than typed. Nova Mono has no →, so that glyph
 * falls to the size-adjusted fallback and comes out long and fine — a 0.06em
 * shaft with an open head 0.30em long and 0.44em across — and the hero's
 * "get in touch" keeps it. Nova Mono does have ↓, and it is a stub; turning
 * the → a quarter instead gave a 1.16em arrow across a 0.74em cap height,
 * which never sat right beside the words. This is the same shaft and head at
 * 0.8em, so it lives inside the text band. Every unit is 0.01em: size it with
 * `width`/`height` in em and it scales with the type; it paints in
 * `currentColor`.
 */
export function ArrowDown({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 50 80" aria-hidden="true" focusable="false">
            <path d="M25 3V74M6 45L25 74L44 45" fill="none" stroke="currentColor" strokeWidth="6" />
        </svg>
    );
}

import { Agdasima, Nova_Mono, Sora } from "next/font/google";

// Agdasima ships 400 and 700 only. 700 is the display cut: it stands in for
// Anton's weight, which the hero and the work-deck numerals were drawn around.
export const displayFont = Agdasima({ subsets: ["latin"], weight: "700" });

// Sora is variable (wght 100-800), so no weight list — every weight the CSS
// asks for, including the 700 on `.about-lead`, comes out of the one file.
export const bodyFont = Sora({ subsets: ["latin"] });

// Nova Mono is 400 only. Nothing mono is ever bolded, in CSS or in markup.
export const monoFont = Nova_Mono({ subsets: ["latin"], weight: "400" });

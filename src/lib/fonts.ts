import { Anton, Archivo, Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";

export const displayFont = Anton({ subsets: ["latin"], weight: "400" });

export const bodyFont = Archivo({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800"],
});

export const monoFont = JetBrains_Mono({
    subsets: ["latin"],
    weight: ["400", "500", "700"],
});

export const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

export const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

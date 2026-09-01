import type { Metadata } from "next";
import { geistMono, geistSans } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.joshuawhatman.com"),
  title: "Joshua Whatman | Sound Designer & Music Producer",
  description:
      "Sound design for TV, Film, Games - Portfolio by Joshua Whatman.",

  openGraph: {
    title: "Joshua Whatman | Sound Designer & Music Producer",
    description:
        "Sound design for TV, Film, Games - Portfolio by Joshua Whatman.",
    url: "https://www.joshuawhatman.com/",
    siteName: "Joshua Whatman",
    images: [
      {
        url: "/ogimage.jpg",
        width: 1200,
        height: 630,
        alt: "Joshua Whatman - Sound Designer & Music Producer",
      },
    ],
    type: "website",
  },

  icons: {
    icon: [
      {
        url: "/favicon-16x16.png",
        type: "image/png",
        sizes: "16x16",
      },
      {
        url: "/favicon-32x32.png",
        type: "image/png",
        sizes: "32x32",
      },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": "https://www.joshuawhatman.com/#person",
      "name": "Joshua Whatman",
      "alternateName": "Josue Davi",
      "url": "https://www.joshuawhatman.com/",
      "jobTitle": "Sound Designer & Music Producer",
      "description":
          "Sound designer and music producer based in Victoria, BC, creating music, sound design, and Foley for film, television, games, animation, and digital media.",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Victoria",
        "addressRegion": "BC",
        "addressCountry": "CA",
      },
      "knowsAbout": [
        "Sound Design",
        "Foley",
        "Audio Post-Production",
        "Music Production",
        "Sound Editing",
        "Music Composition",
        "Writing",
        "Hip Hop",
      ],
      "sameAs": [
        "https://www.linkedin.com/in/joshuawhatman/",
        "https://www.youtube.com/@joshuawhatman",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://www.joshuawhatman.com/#website",
      "url": "https://www.joshuawhatman.com/",
      "name": "Joshua Whatman",
      "description": "Sound design and music portfolio by Joshua Whatman.",
      "publisher": {
        "@id": "https://www.joshuawhatman.com/#person",
      },
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
    <body className="min-h-full flex flex-col">
    {/* YouTube is the one third party on the site, and the reel's embed starts
        loading before anyone presses anything (see `lib/reel`). Open the
        sockets in the document head so that load — and any click that beats it
        — starts on a connection that already exists. React hoists these. */}
    <link rel="preconnect" href="https://www.youtube-nocookie.com" />
    <link rel="preconnect" href="https://www.youtube.com" />
    <link rel="dns-prefetch" href="https://i.ytimg.com" />

    {children}

    <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
    />
    </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import { SkyBody } from "@/components/sky-body";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Scenara — watch together without spoilers",
    template: "%s · Scenara",
  },
  description:
    "A private, spoiler-proof club for friends watching TV series and reading books at different paces.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf5ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1424" },
  ],
};

/** Runs before first paint: saved choice, else the system setting. Avoids a light flash in dark mode. */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("scenara-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;var r=document.documentElement;if(d){r.classList.add("dark");r.style.colorScheme="dark"}}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <SkyBody />
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="px-4 py-6 text-center text-xs text-muted">
          Scenara · Powered by TMDB (TV data) &amp; Open Library (books). This product uses the
          TMDB API but is not endorsed or certified by TMDB.
        </footer>
      </body>
    </html>
  );
}

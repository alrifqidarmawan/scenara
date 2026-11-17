import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="px-4 py-6 text-center text-xs text-muted">
          Scenara · Powered by TMDB (TV data) &amp; Open Library (books). This product uses the
          TMDB API but is not endorsed or certified by TMDB.
        </footer>
      </body>
    </html>
  );
}

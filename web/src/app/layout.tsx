import type { Metadata } from "next";
import { Nunito, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

/* Rounded bold display — closest web match to Arial Rounded MT Bold */
const brand = Nunito({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

const sans = Geist({
  variable: "--font-plex",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CodeAtlas — Google Maps for Software Systems",
  description:
    "Navigate any codebase like a city. Architecture districts first — not folders, not AST dumps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${brand.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}

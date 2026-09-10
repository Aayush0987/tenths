import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/shell/Header";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tenths · F1 race analysis",
  description:
    "What happened in a Formula 1 race and why — tyre degradation, sector losses, race control and telemetry, 2018 onwards.",
};

/**
 * Runs before first paint so the theme never flashes. Dark is the default, so
 * only a stored choice writes an attribute; with nothing stored the OS
 * decides via prefers-color-scheme.
 */
const themeScript = `
  try {
    var t = localStorage.getItem('tenths-theme');
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: themeScript sets data-theme before React
    // hydrates, so the server markup and the live DOM differ here by design.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <a href="#main" className="skip-link">Skip to content</a>
        <Header />
        <main id="main" className="flex-1">{children}</main>
      </body>
    </html>
  );
}

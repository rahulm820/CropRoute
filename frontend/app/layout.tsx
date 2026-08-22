import type { Metadata } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-devanagari",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CropRoute - Food Price & Sourcing Intelligence",
  description: "Wholesale food price and sourcing intelligence for India",
};

/**
 * Inline script to prevent flash-of-wrong-theme.
 * Runs before React hydration, reads localStorage and sets data-theme
 * attribute on <html> so CSS variables resolve correctly from first paint.
 * This is a string because it must be injected as a raw <script> tag.
 */
const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('cropRoute-theme');
    if (t === 'dark' || t === 'light') {
      document.documentElement.setAttribute('data-theme', t);
    } else if (t === 'system' || !t) {
      var d = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', d);
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${notoDevanagari.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans bg-bg text-text antialiased min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}


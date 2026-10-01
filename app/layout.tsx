import type { Metadata, Viewport } from "next";
import "@fontsource-variable/commissioner/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Πρόγραμμα · Vita4you Τσιμισκή",
  description: "Το εβδομαδιαίο πρόγραμμα βαρδιών της ομάδας Vita4you Τσιμισκή.",
  applicationName: "Πρόγραμμα",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Πρόγραμμα", statusBarStyle: "default" },
  formatDetection: { telephone: false, date: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ebedef" },
    { media: "(prefers-color-scheme: dark)", color: "#080a0d" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="el">
      <body>{children}</body>
    </html>
  );
}

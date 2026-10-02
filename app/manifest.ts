import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Πρόγραμμα · Vita4you Τσιμισκή",
    short_name: "Πρόγραμμα",
    description: "Το εβδομαδιαίο πρόγραμμα βαρδιών της ομάδας.",
    start_url: "/",
    display: "standalone",
    background_color: "#fcfdfb",
    theme_color: "#fcfdfb",
    lang: "el",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

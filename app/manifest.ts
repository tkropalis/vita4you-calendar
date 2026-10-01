import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Πρόγραμμα · Vita4you Τσιμισκή",
    short_name: "Πρόγραμμα",
    description: "Το εβδομαδιαίο πρόγραμμα βαρδιών της ομάδας.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f3f7",
    theme_color: "#f2f3f7",
    lang: "el",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}

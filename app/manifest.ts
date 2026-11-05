import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Junta · Despesas em grupo", short_name: "Junta", start_url: "/",
    display: "standalone", background_color: "#f8f8f3", theme_color: "#f8f8f3",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

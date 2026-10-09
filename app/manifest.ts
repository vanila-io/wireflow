import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wireflow - Free Wire / User Flow Tool",
    short_name: "Wireflow",
    description:
      "Wireflow is a free, online and open source tool for creating beautiful user flow prototypes. No Photoshop skills required.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#465BFF",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

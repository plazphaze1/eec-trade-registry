import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#EAE6DC",
    description: "Browse goods, apply for a business license, and verify trade authority.",
    display: "standalone",
    name: "East Empire Company",
    short_name: "EEC Trade",
    start_url: "/",
    theme_color: "#33414A",
  };
}

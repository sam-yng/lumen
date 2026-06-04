import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

// Bumped by hand when the public surface changes — the landing page is the
// only indexable route today, so a stable date avoids needless re-crawls.
const lastModified = "2026-06-04";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteConfig.url,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}

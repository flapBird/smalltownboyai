import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "/pricing",
    "/privacy",
    "/terms",
    "/refund-policy",
    "/acceptable-use",
    "/contact",
  ].map((path) => ({ url: "https://smalltownboyai.one" + path }));
}

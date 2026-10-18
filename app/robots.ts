import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/admin", "/login", "/checkout"],
    },
    sitemap: "https://smalltownboyai.one/sitemap.xml",
  };
}

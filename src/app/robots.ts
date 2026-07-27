import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/superadmin/",
          "/complete-registration/",
          "/pending/",
          "/rejected/",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/superadmin/",
          "/complete-registration/",
          "/pending/",
          "/rejected/",
        ],
      },
    ],
    sitemap: "https://atrium.ieeesbnu.org/sitemap.xml",
    host: "https://atrium.ieeesbnu.org",
  };
}

import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL;
const HOST = BASE || undefined;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/owner/",
          "/keys/",
          "/connectors/",
          "/requests/",
          "/settings/",
          "/support/",
          "/auth/",
          "/account/",
        ],
      },
    ],
    sitemap: BASE ? `${BASE}/sitemap.xml` : undefined,
    host: HOST,
  };
}

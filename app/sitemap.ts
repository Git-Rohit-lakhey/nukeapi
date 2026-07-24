import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/blog";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const STATIC_ROUTES: { path: string; priority: number; change: "daily" | "weekly" | "monthly" }[] = [
  { path: "", priority: 1, change: "weekly" },
  { path: "/blog", priority: 0.8, change: "weekly" },
  { path: "/docs", priority: 0.7, change: "monthly" },
  { path: "/status", priority: 0.5, change: "daily" },
  { path: "/terms", priority: 0.4, change: "monthly" },
  { path: "/privacy", priority: 0.4, change: "monthly" },
  { path: "/dpa", priority: 0.4, change: "monthly" },
  { path: "/refund", priority: 0.4, change: "monthly" },
  { path: "/contact", priority: 0.4, change: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: now,
    changeFrequency: r.change,
    priority: r.priority,
  }));

  const blogEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...blogEntries];
}

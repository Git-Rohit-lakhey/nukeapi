import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/marketing/SiteNav";
import { BLOG_POSTS } from "@/lib/blog";

export const metadata = { title: "Blog" };

export default function BlogIndex() {
  return (
    <>
      <SiteNav />
      <main className="container page" style={{ maxWidth: 760 }}>
        <p className="eyebrow">blog</p>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <h1 style={{ fontSize: 34 }}>Writing</h1>
          <a
            href="/rss.xml"
            style={{
              fontSize: 12,
              color: "var(--t3)",
              border: "1px solid var(--b1)",
              padding: "6px 12px",
              borderRadius: 6,
              whiteSpace: "nowrap",
              marginTop: 8,
            }}
          >
            RSS →
          </a>
        </div>
        <div style={{ marginTop: 24 }}>
          {BLOG_POSTS.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="card" style={{ display: "block", marginTop: 16 }}>
              <div className="dim" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
                {p.date}
              </div>
              <h3 style={{ fontSize: 20, marginTop: 6 }}>{p.title}</h3>
              <p style={{ marginTop: 6 }}>{p.excerpt}</p>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav, SiteFooter } from "@/components/marketing/SiteNav";
import { BLOG_POSTS, getPost } from "@/lib/blog";

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Post not found" };
  return {
    title: `${post.title} — NukeAPI Blog`,
    description: post.excerpt,
    alternates: { canonical: `https://www.nukeapi.dev/blog/${post.slug}` },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <>
      <SiteNav />
      <main className="container page" style={{ maxWidth: 760 }}>
        <Link href="/blog" style={{ fontSize: 13, color: "var(--lime)" }}>← All posts</Link>
        <p className="eyebrow" style={{ marginTop: 16 }}>blog</p>
        <h1 style={{ fontSize: "clamp(1.7rem,3.4vw,2.4rem)", letterSpacing: "-.02em", lineHeight: 1.2 }}>{post.title}</h1>
        <div className="dim mono" style={{ fontSize: 12.5, marginTop: 10 }}>{post.date}</div>
        <p style={{ fontSize: 16, color: "var(--t2)", lineHeight: 1.7, marginTop: 16, borderLeft: "2px solid var(--lime)", paddingLeft: 16 }}>{post.excerpt}</p>
        <article style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          {post.body.map((para, i) => (
            <p key={i} style={{ fontSize: 15.5, lineHeight: 1.85, color: "var(--t1)" }}>{para}</p>
          ))}
        </article>
        <div className="card" style={{ marginTop: 36, textAlign: "center", padding: "32px 24px" }}>
          <h3 style={{ fontSize: 18, marginBottom: 8 }}>Automate your next erasure request</h3>
          <p className="dim" style={{ fontSize: 13.5, marginBottom: 18 }}>One API call. Signed PDF proof. Live in 15 minutes.</p>
          <Link href="/signup" className="btn btn-primary">Start for free →</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

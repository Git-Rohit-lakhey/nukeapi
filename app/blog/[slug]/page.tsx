import { notFound } from "next/navigation";
import { SiteNav, SiteFooter } from "@/components/marketing/SiteNav";
import { BLOG_POSTS, getPost } from "@/lib/blog";

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Blog" };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      publishedTime: post.date,
      url: `/blog/${post.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <>
      <SiteNav />
      <main className="container page" style={{ maxWidth: 720 }}>
        <p className="eyebrow">blog</p>
        <div className="dim" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>{post.date}</div>
        <h1 style={{ fontSize: 34, marginTop: 8 }}>{post.title}</h1>
        <article style={{ marginTop: 24 }}>
          {post.body.map((para, i) => (
            <p key={i} style={{ marginBottom: 18, fontSize: 16 }}>
              {para}
            </p>
          ))}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

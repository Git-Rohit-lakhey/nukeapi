import { SiteNav, SiteFooter } from "@/components/marketing/SiteNav";

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteNav />
      <main className="container page" style={{ maxWidth: 760 }}>
        <p className="eyebrow">legal</p>
        <h1 style={{ fontSize: 34 }}>{title}</h1>
        <p className="dim" style={{ fontSize: 13 }}>Last updated: {updated}</p>
        <div style={{ marginTop: 28 }}>{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

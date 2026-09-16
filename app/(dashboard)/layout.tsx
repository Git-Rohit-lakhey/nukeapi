import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/db/supabase";
import { Logo } from "@/components/Logo";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { SignOutButton } from "@/components/dashboard/SignOutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const ownerEmails = (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const showOwner = ownerEmails.includes(user.email.toLowerCase());
  const initial = (user.email?.[0] ?? "?").toUpperCase();

  return (
    <div className="dash-shell" style={{ display: "flex", minHeight: "100vh", background: "var(--void)" }}>
      <aside
        className="dash-side"
        style={{
          width: 248,
          borderRight: "1px solid var(--b1)",
          padding: "22px 16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          height: "100vh",
          background: "linear-gradient(180deg,#0c0c0e,#080808)",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ padding: "0 12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Logo href="/dashboard" size={22} />
            <span className="badge badge-lime"><span className="dot" />test</span>
          </div>
          <DashboardNav showOwner={showOwner} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--lime-10)", border: "1px solid var(--lime-18)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: "var(--lime)", flexShrink: 0 }}>{initial}</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--t2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main style={{ flex: 1, padding: "36px 40px 90px", maxWidth: 1020, width: "100%", margin: "0 auto" }}>
        {children}
      </main>
      <style>{`@media(max-width:860px){.dash-shell{flex-direction:column}.dash-side{width:100%!important;height:auto!important;position:static!important;border-right:none!important;border-bottom:1px solid var(--b1)}}`}</style>
    </div>
  );
}

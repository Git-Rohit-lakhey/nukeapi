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

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 232,
          borderRight: "1px solid var(--b1)",
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div>
          <div style={{ padding: "0 12px 20px" }}>
            <Logo href="/dashboard" size={22} />
          </div>
          <DashboardNav showOwner={showOwner} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--t3)", padding: "0 12px" }}
          >
            {user.email}
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main style={{ flex: 1, padding: "40px 40px 80px", maxWidth: 980 }}>
        {children}
      </main>
    </div>
  );
}

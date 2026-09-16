"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, string> = {
  "/dashboard": "◈",
  "/connectors": "🔌",
  "/keys": "🔑",
  "/requests": "🧾",
  "/settings": "⚙",
  "/support": "💬",
  "/owner": "👑",
};

export function DashboardNav({ showOwner }: { showOwner: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: "/dashboard", label: "Overview" },
    { href: "/connectors", label: "Connectors" },
    { href: "/keys", label: "API Keys" },
    { href: "/requests", label: "Requests" },
    { href: "/settings", label: "Settings" },
    { href: "/support", label: "Support" },
  ];
  if (showOwner) links.push({ href: "/owner", label: "Owner" });

  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div className="stat-label" style={{ padding: "4px 12px 8px" }}>workspace</div>
      {links.map((l) => {
        const active = pathname === l.href || (l.href !== "/dashboard" && pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              fontSize: 13.5,
              fontWeight: active ? 700 : 500,
              color: active ? "var(--lime)" : "var(--t2)",
              background: active ? "var(--lime-10)" : "transparent",
              border: active ? "1px solid var(--lime-18)" : "1px solid transparent",
              display: "flex",
              alignItems: "center",
              gap: 10,
              transition: "all .15s ease",
            }}
          >
            <span style={{ width: 18, textAlign: "center", opacity: active ? 1 : 0.55 }}>{ICONS[l.href] ?? "·"}</span>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

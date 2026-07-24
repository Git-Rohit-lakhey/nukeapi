"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
    <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {links.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            style={{
              padding: "9px 12px",
              borderRadius: 9,
              fontSize: 14,
              fontWeight: active ? 700 : 500,
              color: active ? "var(--lime)" : "var(--t2)",
              borderLeft: active ? "2px solid var(--lime)" : "2px solid transparent",
              background: active ? "var(--lime-10)" : "transparent",
            }}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

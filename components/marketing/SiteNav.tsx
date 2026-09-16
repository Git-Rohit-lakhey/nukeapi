"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

const NAV_LINKS: Array<[string, string]> = [
  ["Integrations", "#integrations"],
  ["Pricing", "#pricing"],
  ["Developers", "/docs"],
  ["Blog", "/blog"],
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    fn();
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: scrolled ? "rgba(10,10,12,.94)" : "transparent",
        borderBottom: scrolled ? "1px solid #181820" : "1px solid transparent",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        transition: "all .3s",
        padding: "0 6%",
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Logo href="/" size={20} />

        <div
          className="nl"
          style={{ display: "flex", gap: 36 }}
        >
          {NAV_LINKS.map(([label, href]) => (
            <Link key={label} href={href} className="nav-link">
              {label}
            </Link>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/login">
            <button className="bg" style={{ padding: "9px 20px", borderRadius: 8, fontSize: "14px" }}>
              Sign in
            </button>
          </Link>
          <Link href="/signup">
            <button className="bp" style={{ padding: "9px 20px", borderRadius: 8, fontSize: "14px" }}>
              Get API key
            </button>
          </Link>
        </div>
      </div>

      <style>{`
        .nav-link {
          color: #555; font-size: 14px; text-decoration: none;
          transition: color .15s; cursor: pointer;
        }
        .nav-link:hover { color: var(--lime); }
        @media (max-width: 768px) { .nl { display: none !important; } }
      `}</style>
    </nav>
  );
}

export function SiteFooter() {
  const FOOTER_LINKS: Array<[string, string]> = [
    ["Developers", "/docs"],
    ["Terms", "/terms"],
    ["Privacy", "/privacy"],
    ["DPA", "/dpa"],
    ["Refund", "/refund"],
    ["Status", "/status"],
    ["Contact", "/contact"],
  ];

  return (
    <footer style={{ padding: "40px 6%", borderTop: "1px solid #121218", background: "#080809" }}>
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
            <span style={{ color: "var(--lime)" }}>Nuke</span>API
          </div>
          <div style={{ fontSize: 12, color: "#282830" }}>GDPR · CCPA · Data deletion API</div>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 13, color: "#383840", flexWrap: "wrap" }}>
          {FOOTER_LINKS.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className="footer-link"
            >
              {label}
            </Link>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#282830" }}>© 2026 NukeAPI</div>
      </div>

      <style>{`
        .footer-link {
          color: #383840; transition: color .15s; cursor: pointer; text-decoration: none;
        }
        .footer-link:hover { color: var(--lime); }
      `}</style>
    </footer>
  );
}

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

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="badge badge-lime" style={{ marginRight: 2 }}><span className="dot" />test mode</span>
          <Link href="/login">
            <button className="bg" style={{ padding: "9px 18px", borderRadius: 9, fontSize: "13.5px", fontWeight: 600 }}>
              Sign in
            </button>
          </Link>
          <Link href="/signup">
            <button className="bp" style={{ padding: "9px 18px", borderRadius: 9, fontSize: "13.5px" }}>
              Get API key
            </button>
          </Link>
        </div>
      </div>

      <style>{`
        .nav-link {
          color: #9a9aa5; font-size: 13.5px; font-weight: 500; text-decoration: none;
          transition: color .15s; cursor: pointer; letter-spacing: .01em;
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
    <footer style={{ padding: "48px 6% 32px", borderTop: "1px solid #121218", background: "#080809" }}>
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 28,
        }}
      >
        <div style={{ maxWidth: 300 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
            <span style={{ color: "var(--lime)" }}>Nuke</span>API
          </div>
          <div style={{ fontSize: 12.5, color: "#55555f", lineHeight: 1.7 }}>One API call deletes a user everywhere. GDPR · CCPA · LGPD with signed PDF proof.</div>
          <div style={{ marginTop: 12 }}><span className="badge badge-lime"><span className="dot" />all systems operational</span></div>
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

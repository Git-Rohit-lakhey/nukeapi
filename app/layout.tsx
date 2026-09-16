import type { Metadata } from "next";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "NukeAPI — One API call deletes a user everywhere",
    template: "%s · NukeAPI",
  },
  description:
    "Developer-first GDPR/CCPA/LGPD user-deletion API. Fan out a single authenticated call across Stripe, Mailchimp, HubSpot, Intercom and Supabase, with an AES-256-encrypted vault and a cryptographically signed PDF audit trail.",
  keywords: ["GDPR", "CCPA", "LGPD", "right to erasure", "data deletion API", "privacy API"],
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "NukeAPI",
    title: "NukeAPI — One API call deletes a user everywhere",
    description: "GDPR/CCPA/LGPD erasure, automated. Real parallel deletes, encrypted credentials, signed audit trail.",
  },
  twitter: { card: "summary_large_image", title: "NukeAPI — One API call deletes a user everywhere" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
if (!process.env.NEXT_PUBLIC_APP_URL) {
  console.warn("[layout] NEXT_PUBLIC_APP_URL not set — metadata will default to localhost.");
}

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "NukeAPI — One API call deletes a user everywhere",
    template: "%s · NukeAPI",
  },
  description:
    "Developer-first GDPR/CCPA/LGPD user-deletion API. Fan out a single authenticated call across Stripe, Mailchimp, HubSpot, Intercom and Supabase, with an AES-256-encrypted vault and a cryptographically signed PDF audit trail.",
  applicationName: "NukeAPI",
  category: "technology",
  keywords: [
    "GDPR",
    "CCPA",
    "LGPD",
    "right to erasure",
    "article 17",
    "data deletion API",
    "user deletion",
    "privacy API",
    "compliance automation",
    "Stripe delete",
    "Mailchimp delete",
    "audit trail",
  ],
  authors: [{ name: "NukeAPI" }],
  creator: "NukeAPI",
  publisher: "NukeAPI",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "NukeAPI",
    title: "NukeAPI — One API call deletes a user everywhere",
    description:
      "GDPR/CCPA/LGPD erasure, automated. Real parallel deletes, encrypted credentials, signed audit trail.",
  },
  twitter: {
    card: "summary_large_image",
    title: "NukeAPI — One API call deletes a user everywhere",
    description:
      "GDPR/CCPA/LGPD erasure, automated. Real parallel deletes, encrypted credentials, signed audit trail.",
    creator: "@nukeapi",
  },
  alternates: {
    types: {
      "application/rss+xml": [{ url: "/rss.xml", title: "NukeAPI Blog" }],
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${APP_URL}/#organization`,
      name: "NukeAPI",
      url: APP_URL,
      description:
        "Developer-first GDPR/CCPA/LGPD user-deletion API with encrypted credential storage and signed PDF audit trails.",
      slogan: "One API call deletes a user everywhere",
    },
    {
      "@type": "WebSite",
      "@id": `${APP_URL}/#website`,
      url: APP_URL,
      name: "NukeAPI",
      publisher: { "@id": `${APP_URL}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      name: "NukeAPI",
      url: APP_URL,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free sandbox tier — 20 deletions/month across 3 integrations.",
      },
      publisher: { "@id": `${APP_URL}/#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          // Structured data for search engines; static, no user input.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}

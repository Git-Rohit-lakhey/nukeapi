export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  body: string[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "gdpr-right-to-erasure-automatically",
    title: "How to Handle GDPR Right to Erasure Requests Automatically",
    date: "2026-07-10",
    excerpt:
      "A practical guide to fulfilling Article 17 deletion requests across every tool your SaaS uses — without a manual, error-prone scramble.",
    body: [
      "When a user invokes their GDPR Article 17 'right to be forgotten', the clock starts. You have 30 days (extendable by two further months for complex requests) to delete their personal data from every system that holds it. For a modern SaaS, that is rarely one database — it is Stripe, your CRM, your email platform, your auth provider, and often a handful of others.",
      "The naive approach is a runbook: a checklist an engineer works through by hand, logging into each dashboard and searching for the user's email. This is slow, easy to get wrong, and impossible to audit. Worse, a 'not found' in one tool is easily mistaken for 'nothing to delete' when it was actually a typo or an auth failure.",
      "The automated approach is to treat erasure as a single API call. NukeAPI takes one authenticated request with the subject's email and fans it out in parallel to every connected integration, using each provider's real delete endpoint. Each integration reports success, failure, or skipped — and a failure is reported as a failure, never silently swallowed.",
      "Three things make automation trustworthy: credentials must be encrypted at rest (we use AES-256-GCM server-side, so the key never reaches the browser); deletions must retry transient failures with backoff rather than giving up; and the result must be signed so you can prove what happened later. A signed PDF audit trail is what turns 'we think we deleted it' into 'here is cryptographic proof we deleted it, when, and where.'",
      "If you process personal data across more than one tool, automate erasure now — before a request lands in your inbox. The cost of getting it wrong is not just a missed deadline; it is a regulator's fine of up to €20M or 4% of global annual revenue, whichever is higher.",
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

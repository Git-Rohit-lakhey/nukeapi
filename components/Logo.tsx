import Link from "next/link";

/**
 * NukeAPI wordmark — matches the deployed brand: "Nuke" in lime, "API" in white.
 */
export function Logo({ href = "/", size = 20 }: { href?: string; size?: number }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0,
        fontWeight: 800,
        fontSize: size,
        letterSpacing: "-.02em",
        color: "var(--txt)",
        textDecoration: "none",
      }}
    >
      <span style={{ color: "var(--lime)" }}>Nuke</span>
      <span>API</span>
    </Link>
  );
}

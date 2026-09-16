import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400, marginBottom: 28 }}>
        <Logo href="/" size={24} />
      </div>
      {children}
      <div style={{ marginTop: 24, fontSize: 13 }} className="muted">
        <Link href="/">← Back to home</Link>
      </div>
    </div>
  );
}

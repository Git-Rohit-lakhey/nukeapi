import { ImageResponse } from "next/og";

export const alt = "NukeAPI — One API call deletes a user everywhere";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: "#0A0A0A",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 14, height: 64, backgroundColor: "#C8FF00", marginRight: 24 }} />
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: "#FFFFFF" }}>
            <span style={{ color: "#C8FF00" }}>Nuke</span>
            <span>API</span>
          </div>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 40,
            fontWeight: 600,
            color: "#FFFFFF",
            maxWidth: 920,
            lineHeight: 1.2,
          }}
        >
          One API call deletes a user everywhere
        </div>
        <div
          style={{
            marginTop: 30,
            fontSize: 26,
            color: "#A0A0A0",
            letterSpacing: 2,
          }}
        >
          GDPR · CCPA · LGPD — encrypted credentials, signed audit trail
        </div>
      </div>
    ),
    { ...size },
  );
}

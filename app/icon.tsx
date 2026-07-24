import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#0a0a0c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 900,
            color: "#c8f135",
            fontFamily: "monospace",
            letterSpacing: "-2px",
          }}
        >
          N
        </div>
      </div>
    ),
    { ...size },
  );
}

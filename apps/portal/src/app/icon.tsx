import { ImageResponse } from "next/og";

export const size = { height: 64, width: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ alignItems: "center", background: "#18231f", display: "flex", height: "100%", justifyContent: "center", width: "100%" }}>
      <div style={{ alignItems: "center", border: "2px solid #c9a45d", borderRadius: "50%", boxShadow: "inset 0 0 0 3px #18231f, inset 0 0 0 4px #8e713e", color: "#f4e7c9", display: "flex", fontFamily: "serif", fontSize: 16, fontWeight: 800, height: 48, justifyContent: "center", letterSpacing: 1, width: 48 }}>EEC</div>
    </div>,
    size,
  );
}

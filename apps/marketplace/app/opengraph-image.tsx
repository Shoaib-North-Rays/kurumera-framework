import { ImageResponse } from "next/og";

/**
 * The default social card.
 *
 * There was none. The layout declared `twitter: { card: "summary_large_image" }`
 * and no image anywhere in the app, which is the one combination that renders
 * worse than declaring nothing — X reserves the large slot and then draws it
 * blank.
 *
 * Generated rather than shipped as a PNG so it stays in step with the brand
 * without anyone re-exporting an asset, and so it costs no repo weight. Routes
 * that have something better to show — a template's own cover — override this
 * with their own `openGraph.images`.
 */
export const runtime = "edge";
export const alt = "Kurumera Templates — find the perfect website template";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #06301E 0%, #0B7A45 55%, #06301E 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* The mark, drawn inline — satori cannot fetch an external asset. */}
          <svg width="56" height="56" viewBox="0 0 96 96">
            <path d="M14 14 L22 8 L22 84 L14 90 Z" fill="#0A6B4E" />
            <path d="M22 8 L36 12 L36 88 L22 84 Z" fill="#15B586" />
            <path d="M38 58 L74 10 L90 10 L54 58 Z" fill="#1FCE93" />
            <path d="M38 64 L54 64 L78 90 L62 90 Z" fill="#0E9468" />
            <path d="M40 56 L54 56 L47 42 Z" fill="#F6A21E" />
          </svg>
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>kurumera</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.1, letterSpacing: -2 }}>
            Website templates you
          </div>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.1, letterSpacing: -2, color: "#A7F3A0" }}>
            can preview live.
          </div>
          <div style={{ marginTop: 24, fontSize: 28, color: "rgba(255,255,255,0.72)" }}>
            Free and premium · customise without limits · publish on your own domain
          </div>
        </div>
      </div>
    ),
    size,
  );
}

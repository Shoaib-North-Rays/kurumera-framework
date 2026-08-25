/** @type {import('next').NextConfig} */

/**
 * Security headers.
 *
 * There were none — no CSP, no HSTS, no nosniff, no referrer policy, no frame
 * control — on a site that takes card payments and embeds cross-origin iframes.
 *
 * No CSP yet, deliberately. The root layout injects an inline boot script
 * (`layout.tsx`, `dangerouslySetInnerHTML`), so a `script-src` without a nonce
 * or hash would break the motion system on every page. Shipping a broken CSP
 * days before launch is worse than shipping none; the rest of these are
 * unambiguous wins and go in now, with CSP tracked separately.
 */
const securityHeaders = [
  // Do not let a browser second-guess a declared Content-Type. Cheapest
  // defence there is against a MIME-confusion upload.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the origin to other sites, the full path only to ourselves — so a
  // referrer never leaks a query string, and `?session_id=` from the purchase
  // return URL cannot reach a third party.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Two years, preloadable. HTTPS is already enforced at the edge; this stops
  // the first request of a session being made in plaintext at all.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Nothing here needs a camera, a microphone or a location.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // Clickjacking. `frame-ancestors 'none'` rather than X-Frame-Options: this
  // site is never framed — it is the thing doing the framing.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",   // self-contained server bundle for a small container image

  /**
   * BUILD-TIME, NOT RUNTIME — despite what the old comment here claimed.
   *
   * Next's `env` is a webpack DefinePlugin substitution: after `npm run build`
   * these are literal strings in the emitted JS, and the `docker run -e …`
   * documented in the Dockerfile cannot change them. The image is baked to
   * whatever these resolved to at build time. Repointing at a staging
   * push-service means rebuilding, not re-running.
   *
   * KURUMERA_BUILDER_ORIGIN is in here now, and that is the actual bug fix.
   * It was read by `lib/registry.ts` but absent from this block, so the server
   * saw the configured value while the browser saw `undefined` and fell back to
   * the hardcoded production URL. The post-purchase "Open in Editor" button is
   * client-rendered — so a staging deploy would have sent real buyers into the
   * production builder. Server and client now agree, whatever it is set to.
   */
  env: {
    KURUMERA_MARKET_ORIGIN: process.env.KURUMERA_MARKET_ORIGIN || "https://themekit.kurumera.com",
    KURUMERA_AUTH_ORIGIN: process.env.KURUMERA_AUTH_ORIGIN || "https://kurumera.com",
    KURUMERA_BUILDER_ORIGIN: process.env.KURUMERA_BUILDER_ORIGIN || "https://builder.kurumera.com",
  },

  /**
   * Only hosts we actually serve images from.
   *
   * This was `hostname: "**"` — an open image-optimisation proxy. Anyone could
   * point /_next/image at any HTTPS URL on the internet and make this server
   * fetch and re-encode it, at our CPU and bandwidth, on a box that also runs
   * the builder and ~20 store containers.
   *
   * Every real consumer is a template cover from the registry, or a local file
   * from public/ (which needs no entry here at all).
   */
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "themekit.kurumera.com" },
      { protocol: "https", hostname: "**.kurumera.com" },
    ],
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
export default nextConfig;

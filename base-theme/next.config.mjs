/** @type {import('next').NextConfig} */

// Origins allowed to embed this storefront in an <iframe> — the merchant admin's
// live theme customizer previews the store this way. Space-separated; override
// with KURUMERA_ADMIN_ORIGINS. We set `frame-ancestors` (never X-Frame-Options:
// DENY) so these origins can frame it while everyone else still can't.
const FRAME_ANCESTORS =
  process.env.KURUMERA_ADMIN_ORIGINS ||
  "https://kurumera.com https://*.kurumera.com https://theplantsmall.com https://*.theplantsmall.com http://localhost:3000 http://localhost:3001 http://localhost:3002";

const nextConfig = {
  // Theme images come from the store's media/CDN — allow remote sources.
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  // The SDK packages ship as ESM workspace deps.
  transpilePackages: ["@kurumera/storefront", "@kurumera/theme"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: `frame-ancestors 'self' ${FRAME_ANCESTORS};` },
        ],
      },
    ];
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Theme images come from the store's media/CDN — allow remote sources.
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  // The SDK packages ship as ESM workspace deps.
  transpilePackages: ["@kurumera/storefront", "@kurumera/theme"],
};

export default nextConfig;

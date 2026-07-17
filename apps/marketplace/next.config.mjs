/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",   // self-contained server bundle for a small container image
  // Registry API + live theme previews are served by the push-service on themekit.
  // Kept as a runtime env so the same build points at prod or a local push-service.
  env: {
    KURUMERA_MARKET_ORIGIN: process.env.KURUMERA_MARKET_ORIGIN || "https://themekit.kurumera.com",
    KURUMERA_AUTH_ORIGIN: process.env.KURUMERA_AUTH_ORIGIN || "https://kurumera.com",
  },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};
export default nextConfig;

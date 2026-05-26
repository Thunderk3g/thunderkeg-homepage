/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three.js and the R3F ecosystem ship ESM; transpile for Next's bundler.
  transpilePackages: ["three"],
  // No ESLint config yet — don't let lint block builds (type-checking stays on).
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

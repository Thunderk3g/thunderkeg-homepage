/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "http", hostname: "localhost" }],
  },
  eslint: {
    // Lint runs via `npm run lint`. Don't gate `next build` on it — the
    // legacy CLI wrapper in eslint-config-next currently emits a noisy
    // "Unknown options: useEslintrc, extensions" warning on every build.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;

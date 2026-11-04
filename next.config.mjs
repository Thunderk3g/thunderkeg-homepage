/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  // PGlite is client-only (dynamic import in src/os/db/workspace.ts); keep the server bundle from parsing it
  serverExternalPackages: ['@electric-sql/pglite'],
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // PGlite's Node-only branch does `import("node:module")` etc. Strip the `node:` scheme so
      // its package.json "browser" map (module/fs/crypto/... → false) applies in the client build.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, '');
        }),
      );
    }
    return config;
  },
};

export default nextConfig;

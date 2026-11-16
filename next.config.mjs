/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  // the steering canvas reads its dials from YAML at request time; the files must ship with the functions
  outputFileTracingIncludes: {
    '/api/steer/config': ['./steering/dimensions.yaml', './steering/sim.yaml'],
    '/api/steer/generate': ['./steering/dimensions.yaml', './steering/sim.yaml'],
  },
  // ...and nothing else from the Python backend's directory (its code, tests and trained vectors) should
  outputFileTracingExcludes: {
    '/api/steer/*': ['./steering/steerable/**', './steering/tests/**', './steering/gestures/**', './steering/vectors/**', './steering/.*/**', './steering/*.toml', './steering/*.md'],
  },
  // PGlite is client-only (dynamic import in src/os/db/workspace.ts); keep the server bundle from parsing it
  serverExternalPackages: ['@electric-sql/pglite'],
  // the Learning OS became the Stacks record
  redirects: async () => [{ source: '/learning', destination: '/stacks', permanent: true }],
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

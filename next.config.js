/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static export since the app uses API routes
  // output: 'export',
  images: {
    domains: ['localhost'],
  },
};

module.exports = nextConfig; 
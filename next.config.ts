import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // The private order links (/order/<code>) must not leak to other sites through the Referer header
  async headers() {
    return [
      { source: '/order/:path*', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'Cache-Control', value: 'no-store' }] },
      { source: '/account', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
        pathname: '/**',
      },
      // Photos of products added in Supabase with a full link
      { protocol: 'https', hostname: 'ik.imagekit.io', pathname: '/**' },
      { protocol: 'https', hostname: 'bdmblwuvbcfosadnmskv.supabase.co', pathname: '/storage/**' },
    ],
  },
};

export default nextConfig;
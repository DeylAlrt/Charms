import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
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
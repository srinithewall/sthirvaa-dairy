import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    if (isDev) {
      // In development: proxy /api/* → local Spring Boot on port 8080
      // This avoids CORS issues and direct localhost:8080 calls from the browser
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:8080/api/:path*',
        },
        {
          source: '/images/:path*',
          destination: 'http://localhost:8080/images/:path*',
        },
      ];
    }
    // In production: proxy /api/* → remote backend
    return [
      {
        source: '/api/:path*',
        destination: 'https://api-origin.sthirvaa.com/api/:path*',
      },
      {
        source: '/images/:path*',
        destination: 'https://api-origin.sthirvaa.com/images/:path*',
      },
    ];
  },
};

export default nextConfig;

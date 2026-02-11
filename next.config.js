/** @type {import('next').NextConfig} */
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  experimental: {
    const nextConfig = {
  // ...
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  // ...
    };
    serverComponentsExternalPackages: ['@grpc/grpc-js', '@opentelemetry/exporter-trace-otlp-grpc'],
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      }
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  srcDir: 'src',
};

module.exports = withPWA(nextConfig);

import withPWA from "@ducanh2912/next-pwa";

const pwa = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = pwa({
  // Top-level in Next.js 16 (was experimental.serverComponentsExternalPackages)
  serverExternalPackages: [
    "@grpc/grpc-js",
    "@opentelemetry/exporter-trace-otlp-grpc",
  ],

  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
    ],
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  // serverActions now lives inside experimental
  experimental: {
    serverActions: {
      bodySizeLimit: "4.5mb",
    },
  },
});

export default nextConfig;

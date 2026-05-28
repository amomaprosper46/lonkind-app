import withPWA from "@ducanh2912/next-pwa";

const pwa = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = pwa({
  // Next 14 still uses experimental.serverComponentsExternalPackages

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
    serverComponentsExternalPackages: ['firebase-admin', 'genkit', '@genkit-ai/core', '@genkit-ai/google-genai'],
    serverActions: {
      bodySizeLimit: "4.5mb",
    },
  },
});

export default nextConfig;

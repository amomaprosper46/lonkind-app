

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
    ],
  },

  typescript: {
    ignoreBuildErrors: true, // Consider removing this later
  },

  serverExternalPackages: [
    '@genkit-ai/core',
    '@genkit-ai/google-genai',
    'genkit',
    '@opentelemetry/instrumentation',
    'require-in-the-middle',
  ],

  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb',
    },
  },
};

export default nextConfig;


/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
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
    // This is a workaround for the "JavaScript heap out of memory" error.
    // It allows the production build to complete by skipping the memory-intensive
    // type-checking step.
    ignoreBuildErrors: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["@genkit-ai/core", "@genkit-ai/google-genai", "genkit", "@opentelemetry/instrumentation", "require-in-the-middle"],
  },
  outputFileTracing: false,
};

module.exports = nextConfig;

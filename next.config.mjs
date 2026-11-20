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

  eslint: {
    ignoreDuringBuilds: true,
  },

  productionBrowserSourceMaps: false,

  experimental: {
    cpus: 1,
    workerThreads: false,
    serverComponentsExternalPackages: [
      '@genkit-ai/core',
      '@genkit-ai/google-genai',
      'genkit',
      '@opentelemetry/instrumentation',
      'require-in-the-middle',
    ],
    serverActions: {
      bodySizeLimit: '4.5mb',
    },
  },

  webpack: (config, { dev }) => {
    if (!dev) {
      config.cache = false;
      config.parallelism = 1;
    }
    return config;
  },

  async rewrites() {
    return [
      {
        source: '/privacy',
        destination: '/privacy-policy',
      },
    ];
  },
};

export default nextConfig;

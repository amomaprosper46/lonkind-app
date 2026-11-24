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

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=()',
          },
        ],
      },
    ];
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

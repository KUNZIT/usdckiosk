/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. FIX: Correct key for Next.js 14.2.5. This handles the 'pino' and other node-specific module issues.
  serverComponentsExternalPackages: [
    "pino", 
    "pino-pretty", 
    "thread-stream",
    "porto", // Added 'porto' to be safe due to the module not found error
  ],
  
  // 2. Ignore TS errors during build (retained).
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 3. Webpack externals for Node modules (retained for pino/lokijs fix).
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("pino-pretty", "lokijs", "encoding");
    }
    return config;
  },
};

module.exports = nextConfig;
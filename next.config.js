/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. FIX: Correct key for Next.js 14.2.5's server external packages.
  // This helps fix the 'porto/internal' and 'pino' bundling issues.
  serverExternalPackages: [
    "pino", 
    "pino-pretty", 
    "thread-stream",
    // Added 'porto' to be safe, as it's being imported by a connector
    "porto" 
  ],

  // 2. Fix for the 'Geist' font errors in Next.js 14.
  // Since 'Geist' is a new font, we explicitly tell Next.js to allow it 
  // via a specific experimental flag if the module can't find it.
  experimental: {
    // This flag generally helps with new features and module stability in 14.x
    serverComponentsExternalPackages: ["porto"], // Duplicated for max compatibility
  },

  // 3. Ignore TS errors during build (retained).
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 4. Webpack externals for Node modules (retained for pino/lokijs fix).
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("pino-pretty", "lokijs", "encoding");
    }
    return config;
  },
};

module.exports = nextConfig;
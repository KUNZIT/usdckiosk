import type { NextConfig } from "next";

// --- next.config.js ---
/** @type {import('next').NextConfig} */
const nextConfig = {
  // FIX FOR TURBOPACK ERROR:
  // Since this configuration uses a custom `webpack` function, 
  // we must explicitly disable the default experimental bundler, Turbopack, 
  // to prevent the "no `turbopack` config" error in Next.js 16+.
  experimental: {
    turbopack: false,
  },

  // Use webpack to exclude Node.js-only packages
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // These packages contain Node.js-specific code (like fs, pino dependencies) 
      // that breaks the client build if not externalized.
      config.externals.push(
        'pino',
        'thread-stream',
        'fastbench',
        'desm'
      );
    }
    return config;
  },
};

module.exports = nextConfig;

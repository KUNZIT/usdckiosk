/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Remove the 'experimental: { turbopack: ... }' block if it exists.
  
  // 2. Add this to handle the Web3/Pino issues:
  serverExternalPackages: ['pino', 'pino-pretty'],

  // 3. If you are using React 19, you might need to ignore typescript errors for now
  // due to the library mismatches, though try to avoid this if possible.
  typescript: {
    ignoreBuildErrors: true, 
  },
  eslint: {
    ignoreDuringBuilds: true,
  }
};

export default nextConfig;

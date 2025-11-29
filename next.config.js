/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. We keep transpilePackages to stabilize Web3 code bundling
  transpilePackages: [
    '@wagmi/connectors',
    '@web3modal/wagmi',
    '@web3modal/core',
    'wagmi',
    'pino', 
    'thread-stream',
  ],
  
  // 2. Ignore TS errors during build.
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 3. Webpack externals and Aggressive Fixes (CRITICAL)
  webpack: (config, { isServer, webpack }) => {
    // EXPANDED LIST: This list forces Webpack to treat ALL missing, 
    // optional wallet connector dependencies as external.
    config.externals = [
      ...(config.externals || []),
      'porto', 
      'porto/internal', 
      '@base-org/account',
      '@gemini-wallet/core',
      '@metamask/sdk',
      '@safe-global/safe-apps-sdk', 
      '@safe-global/safe-apps-provider',
      
      // --- FIX FOR "Can't resolve 'ws'" ---
      // 'ws' is a Node.js library for WebSockets. Next.js fails to bundle it 
      // for the browser, so we must mark it as external.
      'ws',
      'bufferutil', 
      'utf-8-validate', 
    ];
    
    // Server-side specific ignores
    if (isServer) {
      config.externals.push("pino-pretty", "lokijs", "encoding");
    }

    // AGGRESSIVE FIX: Ignore plugin for the 'porto/internal' import path
    // This handles deep imports that the 'externals' list sometimes misses
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^(porto\/internal)$/,
      })
    );
    
    return config;
  },
};

module.exports = nextConfig;
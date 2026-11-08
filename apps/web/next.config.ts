import type { NextConfig } from 'next';

/**
 * Next.js configuration. Workspace packages ship TypeScript source, so they are
 * transpiled by Next instead of being consumed as prebuilt JavaScript.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@marquee/contracts', '@marquee/domain', '@marquee/spatial'],
  poweredByHeader: false,
  agentRules: false,
};

export default nextConfig;

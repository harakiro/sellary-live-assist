/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("ws", "pg-native");
    }
    return config;
  },
};

export default nextConfig;

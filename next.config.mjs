/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Dodo Payments and third-party APIs are called from server routes.
  // Keep image domains explicit if needed later.
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;

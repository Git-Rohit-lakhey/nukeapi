/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [] },
  // Connector SDKs load lazily via dynamic import() inside run() — keep them
  // as runtime externals so they never enter a client bundle and optional
  // native bits (e.g. cassandra-driver's kerberos) can't break the build.
  serverExternalPackages: [
    "cassandra-driver",
    "mongodb",
    "mysql2",
    "@libsql/client",
    "@aws-sdk/client-s3",
    "@aws-sdk/client-cognito-identity-provider",
    "@google-cloud/storage",
    "@vercel/blob",
    "braintree",
  ],
};
export default nextConfig;

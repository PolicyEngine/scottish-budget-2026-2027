/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin Turbopack to the project root so it does not pick up a stray lockfile
  // from a parent directory during local development or CI.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH !== undefined
  ? process.env.NEXT_PUBLIC_BASE_PATH
  : '/uk/scottish-budget-2026-27';

const nextConfig = {
  ...(basePath ? { basePath } : {}),
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // Pin Turbopack to the project root so it does not pick up a stray lockfile
  // from a parent directory during local development or CI.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

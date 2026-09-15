/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // globe.gl + three-globe ship ESM only — let Next compile them.
  transpilePackages: ["globe.gl", "three-globe"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;

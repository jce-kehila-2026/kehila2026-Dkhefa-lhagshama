/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pages Router is the default in Next 14 when there's a pages/ directory.
  // We also keep `output` unset here so `next dev` works normally;
  // production export (for Firebase Hosting) can be toggled later.
};

module.exports = nextConfig;

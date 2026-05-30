/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pages Router is the default in Next 14 when there's a pages/ directory.
  // We also keep `output` unset here so `next dev` works normally;
  // production export (for Firebase Hosting) can be toggled later.
  // Allow Next.js dev resources (HMR, etc.) from LAN hosts so opening the app
  // via the machine's network IP doesn't trigger cross-origin blocks / refresh
  // loops. Covers private IPv4 ranges used on home/office networks.
  allowedDevOrigins: [
    'strengths-experiences-kingston-purple.trycloudflare.com',
    '192.168.0.0/16',
    '10.0.0.0/8',
    '172.16.0.0/12',
  ],
  // Allow the AssetImage slots to load community photography from Unsplash.
  // Swap these for the NGO's own /public/photos/* before production launch.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

module.exports = nextConfig;

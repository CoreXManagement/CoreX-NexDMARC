/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3", "imapflow", "mailparser"],
};

module.exports = nextConfig;

// Privy's SDK can import Solana, Farcaster and Abstract wallet extras that this EVM-only app never uses;
// they are optional peers, so the bundler is told to leave them out rather than fail the build.
const optionalPeers = [
  "@farcaster/mini-app-solana",
  "@solana/kit",
  "@solana-program/memo",
  "@solana-program/token",
  "@solana-program/system",
  "@abstract-foundation/agw-client",
  "permissionless",
  "encoding",
];

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  webpack(config) {
    config.resolve.alias = { ...config.resolve.alias, ...Object.fromEntries(optionalPeers.map((p) => [p, false])) };
    return config;
  },
};

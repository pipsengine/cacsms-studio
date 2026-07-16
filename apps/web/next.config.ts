import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep the MSSQL driver stack out of App Router server chunks.
  // This avoids fragile vendor-chunk packaging for `tedious` under Next.js.
  serverExternalPackages: ["mssql", "tedious"],
  transpilePackages: ["@cacsms/contracts"]
};

export default nextConfig;

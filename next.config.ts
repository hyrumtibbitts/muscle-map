import type { NextConfig } from "next";

// Static export for GitHub Pages at https://hyrumtibbitts.github.io/muscle-map
const isPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isPages ? "/muscle-map" : "",
  images: { unoptimized: true },
  trailingSlash: true,
  env: { NEXT_PUBLIC_BASE_PATH: isPages ? "/muscle-map" : "" },
};

export default nextConfig;

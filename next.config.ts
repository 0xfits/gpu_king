import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** 导航重构：/donate 是旧路径，永久（308）重定向到 /public */
  async redirects() {
    return [{ source: "/donate", destination: "/public", permanent: true }];
  },
};

export default nextConfig;

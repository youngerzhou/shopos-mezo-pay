import type { NextConfig } from "next";


/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // 强制跳过构建时的类型检查
    ignoreBuildErrors: true,
  },
  eslint: {
    // 强制跳过构建时的 ESLint 检查
    ignoreDuringBuilds: true,
  },
  // 如果你还有其他配置，写在下面
};
export default nextConfig;

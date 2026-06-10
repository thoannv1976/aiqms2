import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Package server-side có require động / engine riêng -> KHÔNG bundle, nạp từ
  // node_modules lúc chạy. Quan trọng cho AWS SDK (driver GCS/S3) và pdf-parse:
  // nếu để bundler xử lý, import động dễ thành stub "module not found" trên prod.
  serverExternalPackages: [
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "pdf-parse",
  ],
};

export default nextConfig;

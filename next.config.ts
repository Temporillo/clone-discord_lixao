import type { NextConfig } from "next";

const envAllowedOrigins = process.env.ALLOWED_DEV_ORIGINS
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: envAllowedOrigins?.length
    ? envAllowedOrigins
    : [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://192.168.3.41:3000",
        "http://192.168.3.41:3001",
      ],
};

export default nextConfig;

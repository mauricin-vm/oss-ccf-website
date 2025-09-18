import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client']
  },
  // Configurações para upload de arquivos
  api: {
    bodyParser: {
      sizeLimit: '100mb'
    }
  }
};

export default nextConfig;

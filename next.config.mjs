/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      // إيصالات الدفع (صور حتى 5 ميجابايت) تُرسل كـ base64 داخل الـ Server Action.
      bodySizeLimit: "10mb",
    },
  },
}

export default nextConfig

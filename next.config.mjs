/** @type {import('next').NextConfig} */

const nextConfig = {
  redirects: async () => {
    return [
      {
        source: "/",
        destination: "/RabbitMQ",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

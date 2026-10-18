import type { NextConfig } from "next";
// Vinext checks multipart bodies before dispatching Route Handlers.
// Keep enough envelope room for the API's independently enforced 8 MiB image cap.
const config: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "9mb" } },
};
export default config;

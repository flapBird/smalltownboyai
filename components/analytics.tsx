import Script from "next/script";
import { ANALYTICS_SCRIPT } from "@/lib/analytics";

export function Analytics() {
  if (process.env.NODE_ENV !== "production") return null;

  return (
    <Script id="site-analytics" strategy="afterInteractive">
      {ANALYTICS_SCRIPT}
    </Script>
  );
}

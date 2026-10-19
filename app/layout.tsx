import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Analytics } from "@/components/analytics";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://smalltownboyai.one"),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  title: {
    default: "Smalltown Boy AI Generator – Create Cat Dance Videos",
    template: "%s | Smalltown Boy AI",
  },
  description:
    "Explore Smalltown Boy-inspired AI pet dance videos. Upload two pet photos and preview our focused video generator. Live generation is coming soon.",
  openGraph: {
    type: "website",
    siteName: "Smalltown Boy AI",
    images: [
      {
        url: "/images/dance-preview.png",
        width: 1024,
        height: 1792,
        alt: "Smalltown Boy AI concept preview",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Header />
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}

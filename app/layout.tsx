import type { Metadata } from "next";
import "./globals.css";

const DESCRIPTION = "A working demo of an AI chief of staff, built by Paula McMahon.";

// Link previews in texts and social apps. Personal links redirect here, so they show the same card. The image is
// public/og/corner-office-share.jpg, made from scripts/share-image.html.
export const metadata: Metadata = {
  metadataBase: new URL("https://lab.moontaxilab.com"),
  title: "Corner Office",
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: "Corner Office",
    title: "Corner Office",
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/og/corner-office-share.jpg", width: 1200, height: 630, alt: "Corner Office, an AI chief of staff demo by Paula McMahon, over a painting of a corner office with an autumn forest view" }],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

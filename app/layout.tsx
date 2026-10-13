import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Corner Office",
  description: "A working demo of an AI chief of staff, built by Paula McMahon.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

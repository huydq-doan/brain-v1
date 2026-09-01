import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BRAIN V1",
  description: "Quăng mọi thứ vào. AI hiểu, nhớ và tìm lại cho bạn.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "BRAIN"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f7f4"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}

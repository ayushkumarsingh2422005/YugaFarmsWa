import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YugaFarms WhatsApp",
  description: "YugaFarms WhatsApp messaging, inbox, and automation dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}

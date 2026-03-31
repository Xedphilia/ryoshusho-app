import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "領収書整理アプリ",
  description: "領収書を撮影・整理・集計するWebアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

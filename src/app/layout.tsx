import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PaperShelf - 論文管理",
  description: "論文情報を収集・管理・閲覧するためのWebアプリケーション",
  openGraph: {
    title: "PaperShelf - 論文管理",
    description: "論文情報を収集・管理・閲覧するためのWebアプリケーション",
    type: "website",
    locale: "ja_JP",
  },
};

// ダークモードのちらつき防止スクリプト
const darkModeScript = `
  (function() {
    var theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ToastProvider>
          <Header />
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}

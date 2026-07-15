import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BATTLE LINE — バトルライン',
  description: '9本のフラッグを挟んで、編成の強さを競い合う2人対戦カードゲーム。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Spline+Sans+Mono:wght@500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

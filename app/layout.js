import './globals.css';

export const metadata = {
  title: '주식 첫걸음 — 초보자 주식 대시보드',
  description: '초보자를 위한 실시간 주식 대시보드',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

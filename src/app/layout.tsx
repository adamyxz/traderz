import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { DeepSeekMonitor } from '@/components/deepseek-monitor';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TraderZ - Trading Platform',
  description: 'Next.js 16 + PostgreSQL + Drizzle ORM',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">{children}</div>
        <DeepSeekMonitor />
      </body>
    </html>
  );
}

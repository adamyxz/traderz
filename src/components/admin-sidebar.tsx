'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users } from 'lucide-react';

const navigation = [{ name: 'Trader Management', href: '/admin/traders', icon: Users }];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <div
      className="fixed left-0 top-0 z-50 flex h-screen w-20 flex-col"
      style={{ backgroundColor: '#1E1E1E' }}
    >
      {/* Logo */}
      <div className="flex h-20 items-center justify-center border-b border-gray-700/30">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-500">
          <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 px-3 py-6">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center justify-center rounded-xl p-3 transition-all
                ${isActive ? 'bg-sky-500/20 text-sky-400' : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'}
              `}
              title={item.name}
            >
              <item.icon className="h-6 w-6" />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

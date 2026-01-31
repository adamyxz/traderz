'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, TrendingUp, Code2, Briefcase, Settings } from 'lucide-react';

const navigation = [
  { name: 'Trading View', href: '/admin/trading', icon: TrendingUp },
  { name: 'Trader Management', href: '/admin/traders', icon: Users },
  { name: 'Position Management', href: '/admin/positions', icon: Briefcase },
  { name: 'Readers', href: '/admin/readers', icon: Code2 },
  { name: 'System Settings', href: '/admin/settings', icon: Settings },
];

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
          <span className="text-2xl font-bold text-white">Z</span>
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

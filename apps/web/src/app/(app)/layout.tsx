'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NotificationBell from '@/components/notifications/NotificationBell';
import AiCommandBar from '@/components/AiCommandBar';

// Platform-level navigation only.
// Solutions (Contractor Edition, LEOS, JKR) are NOT represented here.
// Industry-specific data is accessed via /resources?type=<resourceType>.
// See docs/LCE_V1/Lados_Core_Engine_V1_Implementation_Blueprint.md §3.10
const NAV = [
  { href: '/dashboard',          label: 'Dashboard',    icon: '⊞' },
  { href: '/projects',           label: 'Projects',     icon: '📁' },
  { href: '/resources',          label: 'Resources',    icon: '🗂️' },
  { href: '/approvals',          label: 'Approvals',    icon: '✅' },
  { href: '/ai',                 label: 'AI Assistant', icon: '🤖' },
  { href: '/suppliers',          label: 'Suppliers',    icon: '🏗️' },
  { href: '/packs',              label: 'Packs',        icon: '📦' },
  { href: '/marketplace',        label: 'Marketplace',  icon: '🛒' },
  { href: '/settings/services',  label: 'Services',     icon: '⚙' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col bg-gray-900 text-white overflow-visible">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-gray-700">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm">
            Q
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Lados</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Workflow Platform</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Notifications + Sign out */}
        <div className="px-3 py-4 border-t border-gray-700 space-y-1">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-xs text-gray-500">Notifications</span>
            <NotificationBell />
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <span className="text-base leading-none">→</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Global AI command bar — floating 🤖 button, accessible from all pages */}
      <AiCommandBar />
    </div>
  );
}

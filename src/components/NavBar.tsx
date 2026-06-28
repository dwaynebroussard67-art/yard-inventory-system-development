"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { href: "/", label: "Home", icon: "🏠", roles: ["admin", "crew"] },
  { href: "/scan", label: "Scan", icon: "📷", roles: ["admin", "crew"] },
  { href: "/jobs", label: "Jobs", icon: "📋", roles: ["admin", "crew"] },
  { href: "/receiving", label: "Receive", icon: "📦", roles: ["admin"] },
  { href: "/admin", label: "Admin", icon: "⚙️", roles: ["admin"] },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const filteredNav = navItems.filter((item) => item.roles.includes(user.role));

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <>
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900 border-b border-slate-800 h-14">
        <div className="flex items-center justify-between h-full px-4 max-w-5xl mx-auto">
          <Link href="/" className="flex items-center gap-2 font-bold text-orange-500 text-lg">
            <span className="text-2xl">🔥</span>
            <span className="hidden sm:inline">Forge Load</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:inline">
              {user.fullName} · <span className="text-orange-400 capitalize">{user.role}</span>
            </span>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-300"
              aria-label="Menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Dropdown menu */}
        {menuOpen && (
          <div className="absolute top-14 right-0 left-0 bg-slate-900 border-b border-slate-800 shadow-2xl">
            <div className="max-w-5xl mx-auto px-4 py-2">
              <div className="text-xs text-slate-500 py-2 sm:hidden">
                {user.fullName} · <span className="text-orange-400 capitalize">{user.role}</span>
              </div>
              {filteredNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg mb-1 text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? "bg-orange-500/20 text-orange-400"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 rounded-lg mb-1 text-sm font-medium text-red-400 hover:bg-slate-800 w-full text-left"
              >
                <span>🚪</span>
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Bottom nav for mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 sm:hidden">
        <div className="flex items-center justify-around h-16">
          {filteredNav.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                pathname === item.href
                  ? "text-orange-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Spacers */}
      <div className="h-14" />
    </>
  );
}

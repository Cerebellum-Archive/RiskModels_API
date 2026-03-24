'use client';

import Link from 'next/link';
import Logo from './Logo';
import { Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
    });
    return () => subscription.unsubscribe();
  }, []);

  const navLinks = [
    { href: '/docs/api', label: 'Docs' },
    { href: '/api-reference', label: 'Reference' },
    { href: '/quickstart', label: 'Quickstart' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/account/usage', label: 'Usage' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950 border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo left — matches riskmodels.net spec */}
          <div className="flex-shrink-0">
            <Logo />
          </div>

          {/* Desktop: Nav links (center) | Get API Key (right) */}
          <div className="hidden md:flex items-center gap-8 flex-1 justify-center">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-semibold text-zinc-300 hover:text-zinc-100 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            {!user && (
              <Link
                href="/get-key"
                className="text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Sign in
              </Link>
            )}
            <Link
              href="/get-key"
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              {user ? 'Dashboard' : 'Get API Key'}
            </Link>
          </div>

          {/* Mobile: menu button right */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-zinc-300 hover:text-zinc-100"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-zinc-900 border-t border-zinc-800">
          <div className="px-4 py-3 space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block text-sm font-semibold text-zinc-300 hover:text-zinc-100 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-zinc-800 space-y-2">
              {!user && (
                <Link
                  href="/get-key"
                  className="block text-center text-sm font-medium text-zinc-400 hover:text-zinc-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign in
                </Link>
              )}
              <Link
                href="/get-key"
                className="block px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg text-center transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {user ? 'Dashboard' : 'Get API Key'}
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

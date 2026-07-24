'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [user, setUser] = useState<{ name: string; email: string } | null>({
    name: 'Sarah Chen',
    email: 'sarah@company.com'
  });

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUser({
      name: 'Sarah Chen',
      email: 'sarah@company.com'
    });
    setIsAuthModalOpen(false);
  };

  const navItems = [
    { name: 'Home Page', href: '/', icon: 'home' },
    { name: 'Live Meeting', href: '/dashboard/live', icon: 'videocam' },
    { name: 'Decisions', href: '/dashboard/decisions', icon: 'fact_check' },
    { name: 'Tasks', href: '/dashboard/tasks', icon: 'assignment' },
    { name: 'Knowledge Graph', href: '/dashboard/graph', icon: 'hub' },
    { name: 'Company Memory', href: '/dashboard', icon: 'database' },
  ];

  const getPageTitle = () => {
    if (pathname?.startsWith('/dashboard/meeting/')) return 'Meeting Detail';
    switch (pathname) {
      case '/dashboard/live': return 'Live Meeting';
      case '/dashboard/decisions': return 'Decisions Register';
      case '/dashboard/tasks': return 'Tasks Register';
      case '/dashboard/graph': return 'Knowledge Graph';
      case '/dashboard':
      default: return 'Company Memory';
    }
  };

  return (
    <div className="min-h-screen bg-[#0f131c] text-[#dfe2ef] flex relative overflow-hidden bg-grid-pattern antialiased">
      {/* Ambient glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#c0c1ff]/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#5de6ff]/3 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Sidebar */}
      <nav className="h-screen w-64 fixed left-0 top-0 bg-[#0a0e17] border-r border-[#232B45] shadow-xl flex flex-col py-6 z-50">
        {/* Brand / Header - Links to Home Page */}
        <Link href="/" title="Cue Intelligence - Return to Home Page" className="px-6 mb-6 flex items-center space-x-3 group">
          <div className="w-8 h-8 rounded bg-[#c0c1ff] flex items-center justify-center text-[#1000a9] shadow-[0_0_12px_rgba(192,193,255,0.4)] group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined font-bold text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
          </div>
          <div>
            <h1 className="font-display text-[18px] font-bold text-[#c0c1ff] tracking-tighter leading-tight group-hover:text-white transition-colors">Cue Intelligence</h1>
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-widest font-mono mt-0.5">Enterprise Suite</p>
          </div>
        </Link>

        {/* System Status */}
        <div className="px-6 mb-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-mono text-[#94A3B8] bg-[#181b25] px-3 py-1.5 rounded border border-[#232B45]">
            <span className="w-2 h-2 rounded-full bg-[#34D399] animate-live-pulse"></span>
            System Status: Live
          </div>
        </div>

        {/* Navigation Links */}
        <ul className="flex-1 space-y-1.5 px-3">
          {navItems.map((item) => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname?.startsWith(item.href);
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center px-4 py-3 rounded-lg text-[14px] font-medium transition-all duration-200 ${
                    isActive
                      ? 'text-[#5de6ff] font-bold border-r-2 border-[#5de6ff] bg-[#00cbe6]/10 shadow-[0_0_15px_rgba(0,203,230,0.1)]'
                      : 'text-[#c7c4d7] hover:text-[#c0c1ff] hover:bg-[#262a34]/50 active:scale-95'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[20px] mr-3 ${isActive ? 'text-[#5de6ff]' : 'text-[#94A3B8] group-hover:text-[#c0c1ff]'}`}
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {item.icon}
                  </span>
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Bottom Actions */}
        <div className="px-4 mt-auto space-y-3">
          <Link
            href="/"
            className="flex items-center px-4 py-2.5 rounded-lg text-[#c7c4d7] hover:text-[#c0c1ff] hover:bg-[#262a34]/50 transition-colors text-[14px] font-medium"
          >
            <span className="material-symbols-outlined text-[20px] mr-3">home</span>
            Landing Page
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center px-4 py-2.5 rounded-lg text-[#c7c4d7] hover:text-[#c0c1ff] hover:bg-[#262a34]/50 transition-colors text-[14px] font-medium"
          >
            <span className="material-symbols-outlined text-[20px] mr-3">settings</span>
            Settings
          </Link>

          <Link
            href="/dashboard/live"
            className="w-full bg-[#c0c1ff] text-[#1000a9] font-bold py-3 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(192,193,255,0.4)] hover:bg-[#e1e0ff] transition-all text-[14px]"
          >
            <span className="material-symbols-outlined mr-2 text-[20px]">add</span>
            New Meeting
          </Link>

          {/* User Badge */}
          <div className="flex items-center gap-3 px-3 py-3 mt-2 border-t border-[#232B45]">
            <div className="w-8 h-8 rounded-full bg-[#c0c1ff] text-[#1000a9] flex items-center justify-center text-[12px] font-bold shadow-md">
              SC
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-[#F8FAFC]">{user ? user.name : 'Sarah Chen'}</span>
              <span className="text-[10px] text-[#94A3B8] font-mono">Marketing Lead</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area Wrapper */}
      <div className="ml-64 flex-1 flex flex-col h-screen relative">
        {/* Top App Bar */}
        <header className="bg-[#0f131c]/80 backdrop-blur-md fixed top-0 right-0 left-64 h-16 border-b border-[#232B45] flex items-center justify-between px-6 z-40">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <Link href="/" title="Go to Home Page" className="flex items-center gap-1.5 text-[#94A3B8] hover:text-[#c0c1ff] transition-colors bg-[#181b25] px-2.5 py-1 rounded border border-[#232B45] text-[11px] font-mono">
              <span className="material-symbols-outlined text-[14px]">home</span>
              <span>Home</span>
            </Link>
            <span className="text-[#232B45] mx-0.5">/</span>
            <span className="uppercase tracking-wider text-[11px] bg-[#262a34] px-2.5 py-1 rounded border border-[#232B45] text-[#c0c1ff] font-mono font-semibold">
              Project: Project Apollo
            </span>
            <span className="text-[#232B45] mx-1">/</span>
            <span className="text-[#94A3B8]">{getPageTitle()}</span>
          </div>

          {/* Search + Controls */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#94A3B8]">search</span>
              <input
                className="bg-[#1c1f29] text-[#dfe2ef] pl-9 pr-4 py-1.5 w-64 text-[13px] rounded-lg border border-[#232B45] focus:outline-none focus:border-[#5de6ff]/50 placeholder-[#94A3B8]/60 transition"
                placeholder="Search knowledge graph..."
                type="text"
              />
            </div>

            <div className="flex items-center space-x-2 text-[#94A3B8] relative">
              {/* Dropdown Overlay Backdrop */}
              {isDropdownOpen && (
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setIsDropdownOpen(false)}
                />
              )}

              <button className="hover:text-[#5de6ff] transition relative p-2 rounded-lg hover:bg-[#1c1f29]">
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#f751a1] rounded-full"></span>
              </button>
              <button className="hover:text-[#5de6ff] transition p-2 rounded-lg hover:bg-[#1c1f29]">
                <span className="material-symbols-outlined text-[20px]">help</span>
              </button>
              
              <div 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-8 h-8 rounded-full bg-[#1c1f29] border border-[#232B45] flex items-center justify-center hover:border-[#5de6ff]/50 transition cursor-pointer text-[#c0c1ff] relative z-50"
              >
                <span className="material-symbols-outlined text-[18px]">person</span>
              </div>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 top-11 w-56 rounded-xl bg-[#0a0e17] border border-[#232B45] shadow-2xl backdrop-blur-md p-2.5 z-50">
                  <div className="mb-2 pb-2 border-b border-[#232B45]">
                    <Link 
                      href="/"
                      onClick={() => setIsDropdownOpen(false)}
                      className="w-full flex items-center px-3 py-2 text-xs font-semibold text-[#c0c1ff] hover:bg-[#181b25] rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px] mr-2">home</span>
                      Home Page (Landing)
                    </Link>
                  </div>
                  {user ? (
                    <>
                      <div className="px-3 py-2 border-b border-[#232B45] mb-2">
                        <p className="text-xs font-bold text-white truncate">{user.name}</p>
                        <p className="text-[10px] text-[#94A3B8] truncate">{user.email}</p>
                      </div>
                      <button 
                        onClick={() => {
                          setUser(null);
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-[#ffb4ab] hover:bg-[#93000a]/20 rounded-lg transition-colors cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </>
                  ) : (
                    <div className="space-y-1.5 p-1">
                      <button 
                        onClick={() => {
                          setAuthTab('signin');
                          setIsAuthModalOpen(true);
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-center py-2 text-xs font-bold bg-[#c0c1ff] hover:bg-[#e1e0ff] text-[#1000a9] rounded-lg transition shadow-md shadow-[#c0c1ff]/20 cursor-pointer"
                      >
                        Sign In
                      </button>
                      <button 
                        onClick={() => {
                          setAuthTab('signup');
                          setIsAuthModalOpen(true);
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-center py-2 text-xs font-bold bg-[#181b25] hover:bg-[#262a34] text-[#c7c4d7] border border-[#232B45] rounded-lg transition cursor-pointer"
                      >
                        Sign Up
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 mt-16 p-6 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto animate-fade-in-up">
            {children}
          </div>
        </main>
      </div>

      {/* Authentication Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm border border-[#232B45] p-6 flex flex-col gap-6 relative shadow-2xl bg-[#0a0e17] rounded-2xl">
            <button 
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-white transition-colors p-1 hover:bg-[#181b25] rounded-lg cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div className="flex border-b border-[#232B45] pb-1 mt-2">
              <button 
                onClick={() => setAuthTab('signin')}
                className={`flex-1 pb-3 text-sm font-bold border-b-2 transition cursor-pointer ${
                  authTab === 'signin' 
                    ? 'border-[#5de6ff] text-[#5de6ff]' 
                    : 'border-transparent text-[#94A3B8] hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button 
                onClick={() => setAuthTab('signup')}
                className={`flex-1 pb-3 text-sm font-bold border-b-2 transition cursor-pointer ${
                  authTab === 'signup' 
                    ? 'border-[#5de6ff] text-[#5de6ff]' 
                    : 'border-transparent text-[#94A3B8] hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authTab === 'signup' && (
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] mb-1.5">Full Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Sarah Chen"
                    className="w-full bg-[#181b25] border border-[#232B45] rounded-xl px-4 py-2.5 text-xs text-[#dfe2ef] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#5de6ff] transition"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] mb-1.5">Email Address</label>
                <input 
                  type="email" 
                  required
                  placeholder="sarah@company.com"
                  className="w-full bg-[#181b25] border border-[#232B45] rounded-xl px-4 py-2.5 text-xs text-[#dfe2ef] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#5de6ff] transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] mb-1.5">Password</label>
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  className="w-full bg-[#181b25] border border-[#232B45] rounded-xl px-4 py-2.5 text-xs text-[#dfe2ef] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#5de6ff] transition"
                />
              </div>

              <button 
                type="submit"
                className="w-full py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#c0c1ff] hover:bg-[#e1e0ff] text-[#1000a9] cursor-pointer shadow-lg shadow-[#c0c1ff]/20 transition flex items-center justify-center gap-2 mt-2"
              >
                {authTab === 'signin' ? 'Continue' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

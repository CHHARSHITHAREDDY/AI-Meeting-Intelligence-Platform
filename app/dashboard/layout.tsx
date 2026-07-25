'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const navContainerRef = useRef<HTMLUListElement>(null);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then((data) => {
        if (data.user) {
          setUser({ name: data.user.name, email: data.user.email });
        }
      })
      .catch(() => {
        setUser(null);
      });
  }, []);

  // Breadcrumb shows the real active project name when inside a project
  // workspace, instead of a fixed placeholder.
  useEffect(() => {
    const match = pathname?.match(/^\/dashboard\/projects\/([^/]+)/);
    if (!match) {
      setActiveProjectName(null);
      return;
    }
    fetch(`/api/projects/${match[1]}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setActiveProjectName(data?.project?.name || null))
      .catch(() => setActiveProjectName(null));
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  // Sidebar Items
  const navItems = [
    { name: 'Dashboard', href: '/dashboard', exact: true, icon: 'dashboard' },
    { name: 'Weave AI Chat', href: '/dashboard/chat', exact: true, icon: 'chat' },
    { name: 'Calendar', href: '/dashboard/calendar', exact: false, icon: 'calendar_month' },
    { name: 'Projects', href: '/dashboard/projects', exact: false, icon: 'folder_special' },
    { name: 'Meetings', href: '/dashboard/live', exact: false, icon: 'videocam' },
    { name: 'Upload Meeting', href: '/dashboard/upload', exact: true, icon: 'cloud_upload' },
    { name: 'Analytics & Memory', href: '/dashboard/graph', exact: true, icon: 'analytics' },
    { name: 'Decisions', href: '/dashboard/decisions', exact: false, icon: 'fact_check' },
    { name: 'Tasks', href: '/dashboard/tasks', exact: false, icon: 'assignment' },
  ];

  const getPageTitle = () => {
    if (pathname?.startsWith('/dashboard/meeting/')) return 'Meeting Detail';
    if (pathname?.startsWith('/dashboard/projects/')) return 'Project Workspace';
    switch (pathname) {
      case '/dashboard/chat': return 'Weave AI Chat Assistant';
      case '/dashboard/calendar': return 'Meeting Calendar';
      case '/dashboard/projects': return 'Projects';
      case '/dashboard/live': return 'Live Meeting';
      case '/dashboard/decisions': return 'Decisions Register';
      case '/dashboard/tasks': return 'Tasks Register';
      case '/dashboard/graph': return 'Analytics & Knowledge Graph';
      case '/dashboard/settings': return 'System Settings';
      case '/dashboard/meetings': return 'Meetings';
      case '/dashboard/upload': return 'Upload Meeting';
      case '/dashboard':
      default: return 'Dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-[#162939] text-[#eaeaea] flex relative overflow-hidden bg-grid-pattern antialiased">
      {/* Ambient glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#6a2153]/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#9f8f99]/3 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Sidebar */}
      <nav className="h-screen w-64 fixed left-0 top-0 bg-[#0f1f2d] border-r border-[#2a4a5e] shadow-xl flex flex-col py-6 z-50">
        {/* Brand / Header */}
        <Link href="/dashboard" className="px-6 mb-6 flex items-center space-x-3 group">
          <div className="w-8 h-8 rounded-lg bg-[#6a2153] flex items-center justify-center text-[#f5e2de] shadow-[0_0_15px_rgba(106,33,83,0.4)] group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined font-bold text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
          </div>
          <div>
            <h1 className="font-display text-[18px] font-bold text-[#f5e2de] tracking-tighter leading-tight group-hover:text-[#6a2153] transition-colors">Weave</h1>
            <p className="text-[10px] text-[#9f8f99] uppercase tracking-widest font-mono mt-0.5">Intelligence Platform</p>
          </div>
        </Link>

        {/* System Status */}
        <div className="px-6 mb-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-mono text-[#9f8f99] bg-[#1a3345] px-3 py-1.5 rounded border border-[#2a4a5e]">
            <span className="w-2 h-2 rounded-full bg-[#34D399] animate-live-pulse"></span>
            System Status: Live
          </div>
        </div>

        {/* Navigation Links */}
        <ul ref={navContainerRef} className="flex-1 space-y-1.5 px-3">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));

            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center px-4 py-3 rounded-lg text-[14px] font-medium transition-all duration-200 ${
                    isActive
                      ? 'nav-active-item text-[#6a2153] font-bold border-l-4 border-[#6a2153] bg-[#6a2153]/10 shadow-[0_0_15px_rgba(106,33,83,0.15)]'
                      : 'text-[#dfccc5] hover:text-[#f5e2de] hover:bg-[#1a3345] active:scale-95'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[20px] mr-3 ${isActive ? 'text-[#6a2153]' : 'text-[#9f8f99] group-hover:text-[#f5e2de]'}`}
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
            href="/dashboard/settings"
            className={`flex items-center px-4 py-2.5 rounded-lg text-[14px] font-medium transition-colors ${
              pathname === '/dashboard/settings'
                ? 'text-[#6a2153] bg-[#6a2153]/10 font-bold border-l-4 border-[#6a2153]'
                : 'text-[#dfccc5] hover:text-[#f5e2de] hover:bg-[#1a3345]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px] mr-3">settings</span>
            Settings
          </Link>

          <Link
            href="/dashboard/live"
            className="w-full btn-primary-cta py-3 rounded-lg flex items-center justify-center text-[14px] cursor-pointer"
          >
            <span className="material-symbols-outlined mr-2 text-[20px]">add</span>
            New Meeting
          </Link>

          {/* User Badge */}
          <div className="flex items-center gap-3 px-3 py-3 mt-2 border-t border-[#2a4a5e]">
            <div className="w-8 h-8 rounded-full bg-[#b4a7af] text-[#3f122f] flex items-center justify-center text-[12px] font-bold shadow-md">
              {user ? getInitials(user.name) : 'SC'}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-[13px] font-bold text-[#eaeaea] truncate">{user ? user.name : 'Sarah Chen'}</p>
              <p className="text-[11px] text-[#9f8f99] truncate">{user ? user.email : 'sarah@company.com'}</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="bg-[#162939]/80 backdrop-blur-md fixed top-0 right-0 left-64 h-16 border-b border-[#2a4a5e] flex items-center justify-between px-6 z-40">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2.5 text-[13px] font-medium">
            {/* Single Home Icon Button */}
            <Link 
              href="/" 
              title="Return to Home Page" 
              className="p-1.5 rounded-lg bg-[#1a3345] border border-[#2a4a5e] hover:bg-[#254558] text-[#9f8f99] hover:text-[#b4a7af] transition flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[18px]">home</span>
            </Link>

            {activeProjectName && (
              <>
                <span className="text-[#2a4a5e] mx-0.5">/</span>
                <span className="uppercase tracking-wider text-[11px] bg-[#254558] px-2.5 py-1 rounded border border-[#2a4a5e] text-[#b4a7af] font-mono font-semibold">
                  Project: {activeProjectName}
                </span>
              </>
            )}
            <span className="text-[#2a4a5e] mx-0.5">/</span>
            <span className="text-[#9f8f99] font-mono text-[12px]">{getPageTitle()}</span>
          </div>

          {/* Search + Controls */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#9f8f99]">search</span>
              <input
                className="bg-[#1d3a4d] text-[#eaeaea] pl-9 pr-4 py-1.5 w-64 text-[13px] rounded-lg border border-[#2a4a5e] focus:outline-none focus:border-[#6a2153]/50 placeholder-[#9f8f99]/60 transition"
                placeholder="Search knowledge graph..."
                type="text"
              />
            </div>

            <div className="flex items-center space-x-2 text-[#9f8f99] relative">
              {/* Dropdown Overlay Backdrop */}
              {isDropdownOpen && (
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setIsDropdownOpen(false)}
                />
              )}

              <button className="hover:text-[#b4a7af] transition relative p-2 rounded-lg hover:bg-[#1d3a4d]">
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#6a2153] rounded-full"></span>
              </button>
              <button className="hover:text-[#b4a7af] transition p-2 rounded-lg hover:bg-[#1d3a4d]">
                <span className="material-symbols-outlined text-[20px]">help</span>
              </button>
              
              <div 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-8 h-8 rounded-full bg-[#1d3a4d] border border-[#2a4a5e] flex items-center justify-center hover:border-[#6a2153]/50 transition cursor-pointer text-[#b4a7af] relative z-50"
              >
                <span className="material-symbols-outlined text-[18px]">person</span>
              </div>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 top-11 w-56 rounded-xl bg-[#0f1f2d] border border-[#2a4a5e] shadow-2xl backdrop-blur-md p-2.5 z-50">
                  {user ? (
                    <>
                      <div className="px-3 py-2 border-b border-[#2a4a5e] mb-2">
                        <p className="text-xs font-bold text-[#f5e2de] truncate">{user.name}</p>
                        <p className="text-[10px] text-[#9f8f99] truncate">{user.email}</p>
                      </div>
                      <button 
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-[#ffb4ab] hover:bg-[#93000a]/20 rounded-lg transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[16px]">logout</span>
                        Sign Out
                      </button>
                    </>
                  ) : (
                    <div className="space-y-1.5 p-1">
                      <Link 
                        href="/login"
                        onClick={() => setIsDropdownOpen(false)}
                        className="w-full block text-center py-2 text-xs font-bold bg-[#6a2153] hover:bg-[#7d2d66] text-[#f5e2de] rounded-lg transition shadow-md shadow-[#6a2153]/20 cursor-pointer"
                      >
                        Sign In / Sign Up
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page View Container */}
        <main className="flex-1 pt-20 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

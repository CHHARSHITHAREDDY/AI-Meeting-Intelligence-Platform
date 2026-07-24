'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Video, 
  CheckSquare, 
  ListTodo, 
  Network, 
  Database, 
  Settings, 
  Plus, 
  Search, 
  HelpCircle, 
  User, 
  Bell,
  Info
} from 'lucide-react';


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Live Meeting', href: '/dashboard/live', icon: Video },
    { name: 'Decisions', href: '/dashboard/decisions', icon: CheckSquare },
    { name: 'Tasks', href: '/dashboard/tasks', icon: ListTodo },
    { name: 'Knowledge Graph', href: '/dashboard/graph', icon: Network },
    { name: 'Company Memory', href: '/dashboard', icon: Database },
  ];

  // Breadcrumbs title based on current path
  const getPageTitle = () => {
    if (pathname.startsWith('/dashboard/meeting/')) {
      return 'Meeting Insights';
    }
    switch (pathname) {
      case '/dashboard/live':
        return 'Live Meeting';
      case '/dashboard/decisions':
        return 'Decisions Register';
      case '/dashboard/tasks':
        return 'Tasks Register';
      case '/dashboard/graph':
        return 'Knowledge Graph';
      case '/dashboard':
      default:
        return 'Company Memory';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex relative overflow-hidden bg-grid-pattern antialiased">
      {/* Ambient backgrounds */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-violet-950/20 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-[10%] left-[-10%] w-[500px] h-[500px] bg-fuchsia-950/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      
      {/* SideNavBar */}
      <nav className="h-screen w-64 fixed left-0 top-0 bg-zinc-900/60 backdrop-blur-md border-r border-zinc-800/80 shadow-xl flex flex-col py-6 z-50">
        {/* Brand / Header */}
        <div className="px-6 mb-8 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20 text-white">
            <span className="font-extrabold text-sm tracking-tighter">C</span>
          </div>
          <div>
            <h1 className="text-[18px] font-bold font-display text-zinc-100 tracking-tighter leading-tight">Cue Intelligence</h1>
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono mt-0.5">Enterprise Suite</p>
          </div>
        </div>

        {/* New Meeting Button */}
        <div className="px-4 mb-6">
          <Link href="/dashboard" className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-violet-600/35 hover:scale-[1.02]">
            <Plus className="w-4 h-4" />
            <span>New Meeting</span>
          </Link>
        </div>

        {/* Navigation Links */}
        <ul className="flex-1 space-y-1.5 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'text-violet-400 bg-violet-500/10 border-r-2 border-violet-500'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/50 hover:translate-x-1'
                  }`}
                >
                  <Icon className={`w-4.5 h-4.5 mr-3 ${isActive ? 'text-violet-400' : 'text-zinc-400'}`} />
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Footer Actions */}
        <div className="px-4 mt-auto space-y-4">
          <Link
            href="/dashboard"
            className="flex items-center px-4 py-2.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/50 transition-all text-sm font-semibold border-t border-zinc-800 pt-4"
          >
            <Settings className="w-4.5 h-4.5 mr-3" />
            <span>Settings</span>
          </Link>

          {/* User profile avatar info */}
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full border border-zinc-800 bg-violet-500/10 flex items-center justify-center text-xs font-bold text-violet-400">
              SC
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-200">Sarah Chen</span>
              <span className="text-[10px] text-zinc-500 font-mono">Lead Architect</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Wrapper */}
      <div className="ml-64 flex-1 flex flex-col h-screen relative">
        {/* TopAppBar */}
        <header className="bg-zinc-950/60 backdrop-blur-md text-zinc-100 fixed top-0 right-0 left-64 h-16 border-b border-zinc-900 flex items-center justify-between px-8 w-auto z-40">
          {/* Breadcrumbs */}
          <div className="flex items-center text-xs font-semibold text-zinc-400">
            <span className="uppercase tracking-wider text-[10px] bg-zinc-900 px-2 py-1 rounded border border-zinc-800 text-violet-400">
              Project: Apollo
            </span>
            <span className="mx-2 text-zinc-700">/</span>
            <span className="text-zinc-300">{getPageTitle()}</span>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center space-x-6">
            {/* Global Search */}
            <div className="relative group rounded-full overflow-hidden transition-all border border-zinc-850 bg-zinc-900/50 focus-within:border-violet-500/50">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-zinc-500" />
              </div>
              <input
                className="bg-transparent text-zinc-100 pl-9 pr-4 py-2 w-60 text-xs focus:outline-none placeholder-zinc-650"
                placeholder="Search knowledge graph..."
                type="text"
              />
            </div>

            {/* Profile Icons */}
            <div className="flex items-center space-x-4 text-zinc-400">
              <button className="hover:text-violet-400 transition-all relative p-1 rounded-lg hover:bg-zinc-900">
                <Bell className="w-4.5 h-4.5" />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#f751a1] rounded-full"></span>
              </button>
              <button className="hover:text-violet-400 transition-all p-1 rounded-lg hover:bg-zinc-900">
                <HelpCircle className="w-4.5 h-4.5" />
              </button>
              <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:border-violet-500/40 transition cursor-pointer">
                <User className="w-4 h-4 text-violet-400" />
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Dashboard Viewport */}
        <main className="flex-1 mt-16 p-8 overflow-y-auto w-full max-w-[1440px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

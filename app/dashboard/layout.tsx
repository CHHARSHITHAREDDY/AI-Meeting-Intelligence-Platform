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
    <div className="min-h-screen bg-[#0f131c] text-[#F8FAFC] flex relative overflow-hidden bg-grid-pattern antialiased">
      {/* Ambient backgrounds */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#c0c1ff]/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      
      {/* SideNavBar */}
      <nav className="h-screen w-64 fixed left-0 top-0 bg-[#0a0e17] border-r border-[#232B45] shadow-xl flex flex-col py-6 z-50">
        {/* Brand / Header */}
        <div className="px-6 mb-8 flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-[#c0c1ff] flex items-center justify-center text-[#1000a9]">
            <Network className="w-5 h-5 font-bold" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold font-display text-[#c0c1ff] tracking-tighter leading-tight">Cue Intelligence</h1>
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-widest font-mono mt-0.5">Enterprise Suite</p>
          </div>
        </div>

        {/* New Meeting Button */}
        <div className="px-4 mb-6">
          <Link href="/dashboard" className="w-full bg-[#494bd6] hover:bg-[#8083ff] text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 shadow-[0_0_15px_rgba(73,75,214,0.3)] hover:scale-[1.02]">
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
                      ? 'text-[#5de6ff] bg-[#5de6ff]/10 border-r-2 border-[#5de6ff]'
                      : 'text-[#c7c4d7] hover:text-[#c0c1ff] hover:bg-[#1c1f29]/50 hover:translate-x-1'
                  }`}
                >
                  <Icon className={`w-4 h-4 mr-3 ${isActive ? 'text-[#5de6ff]' : 'text-[#c7c4d7]'}`} />
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
            className="flex items-center px-4 py-2.5 rounded-lg text-[#c7c4d7] hover:text-[#c0c1ff] hover:bg-[#1c1f29]/50 transition-all text-sm font-semibold border-t border-[#232B45] pt-4"
          >
            <Settings className="w-4 h-4 mr-3" />
            <span>Settings</span>
          </Link>

          {/* User profile avatar info */}
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full border border-[#232B45] bg-[#c0c1ff]/10 flex items-center justify-center text-xs font-bold text-[#c0c1ff]">
              SC
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#F8FAFC]">Sarah Chen</span>
              <span className="text-[10px] text-[#94A3B8] font-mono">Lead Architect</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Wrapper */}
      <div className="ml-64 flex-1 flex flex-col h-screen relative">
        {/* TopAppBar */}
        <header className="bg-[#0f131c]/70 backdrop-blur-md text-[#c0c1ff] fixed top-0 right-0 left-64 h-16 border-b border-[#232B45] flex items-center justify-between px-8 w-auto z-40">
          {/* Breadcrumbs */}
          <div className="flex items-center text-xs font-semibold text-[#94A3B8]">
            <span className="uppercase tracking-wider text-[10px] bg-[#262a34] px-2 py-1 rounded border border-[#232B45] text-[#c0c1ff]">
              Project: Apollo
            </span>
            <span className="mx-2 text-[#232B45]">/</span>
            <span className="text-[#dfe2ef]">{getPageTitle()}</span>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center space-x-6">
            {/* Global Search */}
            <div className="relative group rounded-full overflow-hidden transition-all border border-[#232B45] bg-[#181b25] focus-within:border-[#5de6ff]/50">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-[#94A3B8]" />
              </div>
              <input
                className="bg-[#181b25] text-[#dfe2ef] pl-9 pr-4 py-2 w-60 text-xs focus:outline-none placeholder-[#94A3B8]/40"
                placeholder="Search knowledge graph..."
                type="text"
              />
            </div>

            {/* Profile Icons */}
            <div className="flex items-center space-x-4 text-[#c7c4d7]">
              <button className="hover:text-[#5de6ff] transition-all relative p-1 rounded-lg hover:bg-[#1c1f29]">
                <Bell className="w-4.5 h-4.5" />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#f751a1] rounded-full"></span>
              </button>
              <button className="hover:text-[#5de6ff] transition-all p-1 rounded-lg hover:bg-[#1c1f29]">
                <HelpCircle className="w-4.5 h-4.5" />
              </button>
              <div className="w-7 h-7 rounded-full bg-[#1c1f29] border border-[#232B45] flex items-center justify-center hover:border-[#5de6ff]/40 transition cursor-pointer">
                <User className="w-4 h-4 text-[#c0c1ff]" />
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

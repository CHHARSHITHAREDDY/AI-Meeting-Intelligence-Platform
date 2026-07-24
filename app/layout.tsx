import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vocalize | AI Meeting Intelligence Platform',
  description: 'Instantly transcribe and extract summaries, key decisions, action items, and risks from your team meetings using advanced AI.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎙️</text></svg>" />
      </head>
      <body className="min-h-screen bg-zinc-950 text-zinc-50 font-sans antialiased selection:bg-violet-500/30 selection:text-violet-200">
        {/* Ambient background glow elements */}
        <div className="absolute top-0 left-1/4 -translate-x-1/2 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute top-20 right-1/4 translate-x-1/2 w-[600px] h-[600px] bg-fuchsia-600/5 rounded-full blur-[150px] pointer-events-none -z-10" />
        
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}

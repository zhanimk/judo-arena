import React from 'react';
import { AppSidebar } from './AppSidebar';
import { Bell } from 'lucide-react';
import { kz } from '@/lib/kz';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, title }) => {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-14 border-b border-border bg-navy-deep/50 backdrop-blur-sm flex items-center justify-between px-6">
          <h2 className="text-sm font-display font-semibold text-foreground">{title}</h2>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-md hover:bg-navy-surface transition-colors">
              <Bell size={18} className="text-muted-foreground" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            </button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

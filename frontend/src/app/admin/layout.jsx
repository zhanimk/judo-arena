'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { auth } from '../../lib/firebase'; // Importing auth from firebase config
import { onAuthStateChanged, signOut } from 'firebase/auth'; // Importing auth functions

// SidebarItem component remains the same
function SidebarItem({ href, icon, children }) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`sidebar-item w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${
        isActive 
        ? 'bg-navy-700 text-gold' 
        : 'text-gray-300 hover:bg-navy-700'
      }`}
    >
      <span>{icon}</span>
      <span>{children}</span>
    </Link>
  );
}

export default function AdminLayout({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        router.push('/'); // Redirect to homepage if not logged in
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = () => {
    signOut(auth).then(() => {
      router.push('/');
    });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Or a login page component
  }
  
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-64 bg-navy-800 border-r border-navy-600 flex flex-col shrink-0">
        <div className="p-4 border-b border-navy-600">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🥋</span>
            <div>
              <h2 className="font-bold text-gold">JUDO</h2>
              <p className="text-xs text-gray-400">Tournament System</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem href="/admin/dashboard" icon="🏠">
            Басты бет
          </SidebarItem>
          <SidebarItem href="/admin/tournaments" icon="🏆">
            Турнирлер
          </SidebarItem>
          <SidebarItem href="/admin/create-tournament" icon="✨">
            Жаңа турнир құру
          </SidebarItem>
        </nav>
        <div className="p-4 border-t border-navy-600">
          <button 
            onClick={handleLogout} 
            className="w-full py-2 text-gray-400 hover:text-red-400 transition-colors flex items-center justify-center gap-2"
          >
            <span>🚪</span> Шығу
          </button>
        </div>
      </aside>
      
      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { kz } from '@/lib/kz';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';
import { UserRole } from '@/lib/types';

const RegisterPage: React.FC = () => {
  const [role, setRole] = useState<UserRole>('athlete');
  const allRoles: UserRole[] = ['athlete', 'coach', 'admin', 'judge'];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl gradient-gold flex items-center justify-center mx-auto mb-4">
            <Trophy size={24} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">{kz.auth.registerTitle}</h1>
        </div>
        <div className="card-premium p-6 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{kz.auth.fullName}</label>
            <input type="text" className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{kz.auth.email}</label>
            <input type="email" className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{kz.auth.password}</label>
            <input type="password" className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{kz.auth.selectRole}</label>
            <div className="grid grid-cols-2 gap-2">
              {allRoles.map(r => (
                <button key={r} onClick={() => setRole(r)}
                  className={`px-3 py-2 rounded-md text-xs font-medium border transition-colors ${
                    r === role ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-navy-surface text-muted-foreground hover:bg-navy-lighter'
                  }`}>
                  {kz.roles[r]}
                </button>
              ))}
            </div>
          </div>
          <Link to="/admin"><Button variant="gold" className="w-full">{kz.auth.registerButton}</Button></Link>
          <p className="text-xs text-center text-muted-foreground">
            {kz.auth.hasAccount} <Link to="/login" className="text-primary hover:underline">{kz.nav.login}</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;

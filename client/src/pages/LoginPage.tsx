import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { kz } from '@/lib/kz';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl gradient-gold flex items-center justify-center mx-auto mb-4">
            <Trophy size={24} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">{kz.auth.loginTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">Judo-Arena</p>
        </div>
        <div className="card-premium p-6 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{kz.auth.email}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{kz.auth.password}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <Link to="/admin"><Button variant="gold" className="w-full">{kz.auth.loginButton}</Button></Link>
          <p className="text-xs text-center text-muted-foreground">
            {kz.auth.noAccount} <Link to="/register" className="text-primary hover:underline">{kz.nav.register}</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

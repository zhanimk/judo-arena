import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { kz } from '@/lib/kz';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { UserRole } from '@/lib/types';

function roleDashboardPath(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'coach':
      return '/coach';
    case 'athlete':
      return '/athlete';
    case 'judge':
      return '/judge';
    default:
      return '/';
  }
}

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const loggedInUser = await login({ email, password });
      const fallbackPath = roleDashboardPath(loggedInUser.role.toLowerCase() as UserRole);
      navigate(fromPath || fallbackPath, { replace: true });
    } catch {
      setErrorMessage('Неверный email или пароль');
    } finally {
      setIsSubmitting(false);
    }
  };

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

        <form className="card-premium p-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{kz.auth.email}</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{kz.auth.password}</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}

          <Button type="submit" variant="gold" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Жүктелуде...' : kz.auth.loginButton}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            {kz.auth.noAccount}{' '}
            <Link to="/register" className="text-primary hover:underline">
              {kz.nav.register}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;

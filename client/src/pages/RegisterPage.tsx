import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { kz } from '@/lib/kz';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';
import { UserRole } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [role, setRole] = useState<UserRole>('athlete');
  const allRoles: UserRole[] = ['athlete', 'coach'];
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await register({
        fullName,
        email,
        password,
        role: role === 'coach' ? 'COACH' : 'ATHLETE',
      });

      navigate(role === 'coach' ? '/coach' : '/athlete', { replace: true });
    } catch {
      setErrorMessage('Тіркелу кезінде қате орын алды');
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
          <h1 className="text-2xl font-display font-bold text-foreground">{kz.auth.registerTitle}</h1>
        </div>
        <form className="card-premium p-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{kz.auth.fullName}</label>
            <input
              required
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
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
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{kz.auth.selectRole}</label>
            <div className="grid grid-cols-2 gap-2">
              {allRoles.map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  className={`px-3 py-2 rounded-md text-xs font-medium border transition-colors ${
                    r === role
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-navy-surface text-muted-foreground hover:bg-navy-lighter'
                  }`}
                >
                  {kz.roles[r]}
                </button>
              ))}
            </div>
          </div>

          {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}

          <Button type="submit" variant="gold" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Жүктелуде...' : kz.auth.registerButton}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            {kz.auth.hasAccount}{' '}
            <Link to="/login" className="text-primary hover:underline">
              {kz.nav.login}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { kz } from '@/lib/kz';
import { UserRole } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  Trophy,
  Users,
  FileCheck,
  GitBranch,
  Building2,
  User,
  Medal,
  ClipboardList,
  Monitor,
  Timer,
  Shield,
  Dumbbell,
  GraduationCap,
  Scale,
  LogOut,
} from 'lucide-react';

const roleNavItems: Record<UserRole, { label: string; path: string; icon: React.ReactNode }[]> = {
  admin: [
    { label: kz.nav.dashboard, path: '/admin', icon: <LayoutDashboard size={18} /> },
    { label: kz.nav.tournaments, path: '/admin/tournaments', icon: <Trophy size={18} /> },
    { label: kz.nav.applications, path: '/admin/applications', icon: <FileCheck size={18} /> },
    { label: kz.nav.brackets, path: '/admin/brackets', icon: <GitBranch size={18} /> },
    { label: kz.nav.users, path: '/admin/users', icon: <Users size={18} /> },
    { label: kz.nav.clubs, path: '/admin/clubs', icon: <Building2 size={18} /> },
  ],
  athlete: [
    { label: kz.nav.dashboard, path: '/athlete', icon: <LayoutDashboard size={18} /> },
    { label: kz.nav.profile, path: '/athlete/profile', icon: <User size={18} /> },
    { label: kz.nav.clubs, path: '/athlete/club', icon: <Building2 size={18} /> },
    { label: kz.nav.participation, path: '/athlete/participation', icon: <Medal size={18} /> },
    { label: kz.nav.results, path: '/athlete/results', icon: <GitBranch size={18} /> },
  ],
  coach: [
    { label: kz.nav.dashboard, path: '/coach', icon: <LayoutDashboard size={18} /> },
    { label: kz.nav.clubs, path: '/coach/club', icon: <Building2 size={18} /> },
    { label: kz.nav.athletes, path: '/coach/athletes', icon: <Users size={18} /> },
    { label: kz.nav.applications, path: '/coach/applications', icon: <ClipboardList size={18} /> },
    { label: kz.nav.tournaments, path: '/coach/tournaments', icon: <Trophy size={18} /> },
  ],
  judge: [
    { label: kz.nav.dashboard, path: '/judge', icon: <LayoutDashboard size={18} /> },
    { label: kz.nav.tatamiQueue, path: '/judge/queue', icon: <ClipboardList size={18} /> },
    { label: kz.nav.matchControl, path: '/judge/match', icon: <Timer size={18} /> },
    { label: kz.nav.scoreboard, path: '/judge/scoreboard', icon: <Monitor size={18} /> },
  ],
};

const roleIcons: Record<UserRole, React.ReactNode> = {
  admin: <Shield size={16} />,
  athlete: <Dumbbell size={16} />,
  coach: <GraduationCap size={16} />,
  judge: <Scale size={16} />,
};

const roleColors: Record<UserRole, string> = {
  admin: 'text-primary',
  athlete: 'text-info',
  coach: 'text-success',
  judge: 'text-warning',
};

export const AppSidebar: React.FC = () => {
  const { role, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const uiRole: UserRole = role || 'athlete';
  const navItems = roleNavItems[uiRole];

  const onLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="w-64 min-h-screen bg-navy-deep border-r border-border flex flex-col">
      <Link to="/" className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-9 h-9 rounded-lg gradient-gold flex items-center justify-center">
          <Trophy size={20} className="text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold text-foreground tracking-tight">Judo-Arena</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{kz.roles[uiRole]}</p>
        </div>
      </Link>

      <div className="px-3 py-3 border-b border-border">
        <div className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-navy-light text-sm">
          <span className="flex items-center gap-2">
            <span className={roleColors[uiRole]}>{roleIcons[uiRole]}</span>
            <span className="text-muted-foreground">{kz.roles[uiRole]}</span>
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                isActive
                  ? 'bg-navy-surface text-primary border-l-2 border-primary'
                  : 'text-muted-foreground hover:bg-navy-light hover:text-foreground'
              }`}
            >
              <span className={isActive ? 'text-primary' : ''}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-border space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-navy-surface flex items-center justify-center text-sm font-medium text-primary">
            {(user?.fullName || 'UA').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.fullName || 'User'}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-navy-light hover:bg-navy-surface text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut size={14} /> {kz.nav.logout}
        </button>
      </div>
    </aside>
  );
};

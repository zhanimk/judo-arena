import React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  upcoming: 'bg-info/15 text-info border-info/30',
  active: 'bg-success/15 text-success border-success/30',
  completed: 'bg-muted text-muted-foreground border-border',
  draft: 'bg-navy-surface text-muted-foreground border-border',
  pending: 'bg-warning/15 text-warning border-warning/30',
  approved: 'bg-success/15 text-success border-success/30',
  rejected: 'bg-destructive/15 text-destructive border-destructive/30',
  scheduled: 'bg-info/15 text-info border-info/30',
  live: 'bg-success/15 text-success border-success/30 animate-pulse-gold',
};

const statusLabels: Record<string, string> = {
  upcoming: 'Алдағы',
  active: 'Белсенді',
  completed: 'Аяқталған',
  draft: 'Жоба',
  pending: 'Күтілуде',
  approved: 'Мақұлданған',
  rejected: 'Қабылданбаған',
  scheduled: 'Жоспарланған',
  live: 'Тікелей',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
      statusStyles[status] || 'bg-muted text-muted-foreground border-border',
      className
    )}>
      {status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-success mr-1.5 animate-pulse" />}
      {statusLabels[status] || status}
    </span>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, className }) => (
  <div className={cn('card-premium p-5 flex items-start justify-between', className)}>
    <div>
      <p className="text-sm text-muted-foreground mb-1">{title}</p>
      <p className="text-2xl font-display font-bold text-foreground">{value}</p>
      {trend && <p className="text-xs text-success mt-1">{trend}</p>}
    </div>
    <div className="w-10 h-10 rounded-lg bg-navy-surface flex items-center justify-center text-primary">
      {icon}
    </div>
  </div>
);

interface DataTableProps {
  headers: string[];
  children: React.ReactNode;
  className?: string;
}

export const DataTable: React.FC<DataTableProps> = ({ headers, children, className }) => (
  <div className={cn('card-premium overflow-hidden', className)}>
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-navy-deep/50">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {children}
        </tbody>
      </table>
    </div>
  </div>
);

export const SectionTitle: React.FC<{ children: React.ReactNode; action?: React.ReactNode }> = ({ children, action }) => (
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-lg font-display font-semibold text-foreground">{children}</h3>
    {action}
  </div>
);

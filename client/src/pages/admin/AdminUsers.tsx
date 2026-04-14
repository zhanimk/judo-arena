import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, StatusBadge, DataTable } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { Search, Ban, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getUsers, updateUserStatus, UserRole, UserStatus } from '@/api/users';

const roleOptions: Array<{ value: 'all' | UserRole; label: string }> = [
  { value: 'all', label: kz.users.allRoles },
  { value: 'ATHLETE', label: kz.roles.athlete },
  { value: 'COACH', label: kz.roles.coach },
  { value: 'JUDGE', label: kz.roles.judge },
  { value: 'ADMIN', label: kz.roles.admin },
];

const statusOptions: Array<{ value: 'all' | UserStatus; label: string }> = [
  { value: 'all', label: kz.application.all },
  { value: 'ACTIVE', label: kz.status.active },
  { value: 'INACTIVE', label: kz.status.draft },
  { value: 'BLOCKED', label: kz.status.blocked },
];

const roleLabel = (role: UserRole): string => {
  switch (role) {
    case 'ATHLETE':
      return kz.roles.athlete;
    case 'COACH':
      return kz.roles.coach;
    case 'JUDGE':
      return kz.roles.judge;
    case 'ADMIN':
    default:
      return kz.roles.admin;
  }
};

const mapStatusToBadge = (status: UserStatus): 'approved' | 'rejected' | 'pending' => {
  if (status === 'ACTIVE') return 'approved';
  if (status === 'BLOCKED') return 'rejected';
  return 'pending';
};

const AdminUsers: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');

  const usersQuery = useQuery({
    queryKey: ['admin-users', roleFilter, statusFilter, search],
    queryFn: () =>
      getUsers({
        role: roleFilter === 'all' ? undefined : roleFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search.trim() || undefined,
        page: 1,
        limit: 100,
      }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) => updateUserStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const users = usersQuery.data?.items || [];

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [users]
  );

  const toggleBlock = (id: string, currentStatus: UserStatus) => {
    const nextStatus: UserStatus = currentStatus === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
    toggleStatusMutation.mutate({ id, status: nextStatus });
  };

  return (
    <AppLayout title={kz.nav.users}>
      <div className="space-y-6 animate-slide-in">
        <div className="flex items-center justify-between">
          <SectionTitle>{kz.nav.users}</SectionTitle>
          <span className="text-xs text-muted-foreground">
            {kz.common.total}: {usersQuery.data?.total || 0}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full pl-9 pr-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={kz.table.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
            className="px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {kz.users.filterByRole}: {role.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | UserStatus)}
            className="px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {kz.users.status}: {option.label}
              </option>
            ))}
          </select>
        </div>

        {usersQuery.isLoading && <div className="text-sm text-muted-foreground">Loading users...</div>}
        {usersQuery.isError && <div className="text-sm text-destructive">Failed to load users.</div>}

        {!usersQuery.isLoading && !usersQuery.isError && (
          <DataTable headers={[kz.table.name, kz.users.email, kz.users.role, kz.table.club, kz.users.registeredAt, kz.users.lastActive, kz.users.status, kz.table.actions]}>
            {sortedUsers.map((u) => (
              <tr key={u._id} className="hover:bg-navy-light/50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-foreground">{u.fullName}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3 text-sm text-primary font-medium">{roleLabel(u.role)}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{u.clubId?.name || '—'}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={mapStatusToBadge(u.status)} />
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title={u.status === 'BLOCKED' ? kz.users.unblockUser : kz.users.blockUser}
                    onClick={() => toggleBlock(u._id, u.status)}
                    disabled={toggleStatusMutation.isPending}
                  >
                    {u.status === 'BLOCKED' ? <CheckCircle size={14} className="text-success" /> : <Ban size={14} />}
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminUsers;

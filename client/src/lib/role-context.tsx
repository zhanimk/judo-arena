import React, { createContext, useContext, useState } from 'react';
import { UserRole } from '@/lib/types';

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
}

const RoleContext = createContext<RoleContextType>({ role: 'admin', setRole: () => {} });

export const useRole = () => useContext(RoleContext);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>('admin');
  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
};

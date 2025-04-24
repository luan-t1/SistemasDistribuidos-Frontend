import React, { createContext, useState, useContext, ReactNode } from 'react';

interface UserContextType {
  nickname: string;
  setNickname: (nickname: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [nickname, setNickname] = useState<string>('');

  return (
    <UserContext.Provider value={{ nickname, setNickname }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

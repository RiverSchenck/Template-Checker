// MenuContext.tsx for TypeScript projects
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  Dispatch,
  SetStateAction,
  useMemo,
} from 'react';

interface MenuContextType {
  menuKey: string;
  setMenuKey: Dispatch<SetStateAction<string>>;
}

const defaultContextValue: MenuContextType = {
  menuKey: 'upload-template',
  setMenuKey: () =>
    console.warn('setMenuKey was called without a MenuProvider'),
};

const MenuContext = createContext<MenuContextType>(defaultContextValue);

export const useMenu = () => useContext(MenuContext);

export function MenuProvider({ children }: { children: ReactNode }) {
  const [menuKey, setMenuKey] = useState('upload-template');
  const value = useMemo(() => ({ menuKey, setMenuKey }), [menuKey, setMenuKey]);

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

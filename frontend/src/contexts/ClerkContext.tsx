import { createContext, type ReactNode, useContext } from "react";

interface ClerkContextType {
  isClerkEnabled: boolean;
}

const ClerkContext = createContext<ClerkContextType>({
  isClerkEnabled: false,
});

export function ClerkEnabledProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  return (
    <ClerkContext.Provider value={{ isClerkEnabled: enabled }}>
      {children}
    </ClerkContext.Provider>
  );
}

export function useClerkEnabled() {
  return useContext(ClerkContext).isClerkEnabled;
}

// For backwards compatibility - always returns true since Clerk loads synchronously
export function useClerkLoaded() {
  return true;
}

// For backwards compatibility
export function useClerkContext() {
  const { isClerkEnabled } = useContext(ClerkContext);
  return {
    isClerkEnabled,
    isClerkLoaded: true,
    setClerkLoaded: () => {},
  };
}

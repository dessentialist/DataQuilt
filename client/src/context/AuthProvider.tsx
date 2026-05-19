import { createContext, useContext, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { User, ApiKeysRequest } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithGoogle: () => void;
  logout: () => void;
  saveApiKeys: (keys: ApiKeysRequest) => void;
  isLogoutPending: boolean;
  isSavingKeys: boolean;
}

// Create context with null as default to handle Fast Refresh better
const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();

  // DEBUG: Context provider lifecycle logging
  console.log("AuthProvider rendering with auth state:", {
    hasUser: !!auth.user,
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    timestamp: new Date().toISOString(),
  });

  if (auth.isLoading) {
    console.log("AuthProvider loading state - delaying render until session check completes");
    return (
      <AuthContext.Provider value={auth}>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-oracle-accent" />
        </div>
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

// Fast Refresh compatible context hook - use const declaration
export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === null || context === undefined) {
    // During Fast Refresh, context may temporarily be null
    // Return a safe fallback instead of throwing
    console.warn("AuthContext not available - returning fallback state during Fast Refresh");
    return {
      user: null,
      isLoading: true,
      isAuthenticated: false,
      loginWithGoogle: () => {},
      logout: () => {},
      saveApiKeys: () => {},
      isLogoutPending: false,
      isSavingKeys: false,
    };
  }

  return context;
};

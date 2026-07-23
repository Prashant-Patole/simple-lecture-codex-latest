import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";


interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    const handleIdentityChange = (nextId: string | null) => {
      // Only react to true identity transitions (sign-in / sign-out / user swap),
      // not TOKEN_REFRESHED / INITIAL_SESSION echoes with the same user.
      if (prevUserIdRef.current === undefined) {
        prevUserIdRef.current = nextId;
        return;
      }
      if (prevUserIdRef.current === nextId) return;
      prevUserIdRef.current = nextId;
      // Refetch all cached queries against the new auth context so freshly-
      // signed-in users see content their anon session couldn't read (e.g.
      // published preview lectures, enrollment checks).
      queryClient.invalidateQueries();
    };

    // Set up auth state listener for ONGOING changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        handleIdentityChange(session?.user?.id ?? null);
        
        // After initial session, subsequent events can update loading
        if (event !== 'INITIAL_SESSION') {
          setIsLoading(false);
        }
      }
    );

    // INITIAL load - controls isLoading
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        handleIdentityChange(session?.user?.id ?? null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);


  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

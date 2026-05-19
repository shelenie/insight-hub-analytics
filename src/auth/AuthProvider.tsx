import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** True once we've completed the initial getSession check at least once. */
  initialized: boolean;
  signOut: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getAppRedirectUrl = () => new URL(import.meta.env.BASE_URL, window.location.origin).toString();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const hasInitial = useRef(false);

  useEffect(() => {
    const cleanupAuthRedirectUrl = () => {
      const basePath = new URL(import.meta.env.BASE_URL, window.location.origin).pathname;
      window.history.replaceState({}, document.title, `${basePath}${window.location.hash || ""}`);
    };

    const hasAuthHashTokens = () => {
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
      const hashParams = new URLSearchParams(hash);
      return hashParams.has("access_token") || hashParams.has("refresh_token") || hashParams.has("error");
    };

    const hasAuthQueryCode = () => {
      const params = new URLSearchParams(window.location.search);
      return params.has("code");
    };

    const maybeExchangeRedirectSession = async () => {
      const authCode = new URLSearchParams(window.location.search).get("code");
      if (authCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(authCode);
        if (error) {
          console.warn("[Auth] Failed to exchange auth code for session.", error.message);
        } else {
          cleanupAuthRedirectUrl();
        }
      }

      if (hasAuthHashTokens()) {
        const { error } = await supabase.auth.getSession();
        if (error) {
          console.warn("[Auth] Failed to read hash-based auth session.", error.message);
        } else {
          cleanupAuthRedirectUrl();
        }
      }
    };

    // Listener first — captures sign-in/out, token refresh, OAuth redirect.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (hasInitial.current) {
        setLoading(false);
      }
    });

    // Then handle redirect auth session exchange and read persisted session.
    maybeExchangeRedirectSession()
      .catch((err: unknown) => {
        console.warn("[Auth] Unexpected redirect session handling error.", err);
      })
      .then(() => supabase.auth.getSession())
      .then(({ data }) => {
      setSession(data.session);
      hasInitial.current = true;
      setInitialized(true);
      setLoading(false);
        if (hasAuthQueryCode()) {
          cleanupAuthRedirectUrl();
        }
      });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Invite-only.
        shouldCreateUser: false,
        emailRedirectTo: getAppRedirectUrl(),
      },
    });
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, initialized, signOut, signInWithMagicLink }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

import { createContext, useContext, useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { setAuthTokenGetter, claimUserLinks } from '../services/api.js';

const AuthContext = createContext({
  isLoaded: true,
  isSignedIn: false,
  user: null,
  getToken: async () => null,
  hasClerk: false,
});

function ClerkInnerAuthProvider({ children, onClaimSuccess }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const hasClaimedRef = useRef(false);

  // Wire up Axios request interceptor with Clerk JWT token
  useEffect(() => {
    if (isSignedIn) {
      setAuthTokenGetter(getToken);
    } else {
      setAuthTokenGetter(null);
    }
  }, [isSignedIn, getToken]);

  // Auto-Sync Hook: Upon successful sign-in, read `lynq-recent` from localStorage,
  // call /api/user/claim-links, clear localStorage, and trigger celebratory toast
  useEffect(() => {
    if (isLoaded && isSignedIn && !hasClaimedRef.current) {
      const stored = localStorage.getItem('lynq-recent');
      if (stored) {
        try {
          const links = JSON.parse(stored);
          if (Array.isArray(links) && links.length > 0) {
            hasClaimedRef.current = true;
            claimUserLinks(links)
              .then((res) => {
                if (res.success && res.claimedCount > 0) {
                  localStorage.removeItem('lynq-recent');
                  if (onClaimSuccess) {
                    onClaimSuccess(res.claimedCount);
                  }
                }
              })
              .catch((err) => {
                console.error('Failed to claim guest links:', err);
              });
          }
        } catch {
          // ignore corrupted local state
        }
      }
    }
  }, [isLoaded, isSignedIn, onClaimSuccess]);

  return (
    <AuthContext.Provider value={{ isLoaded, isSignedIn, user, getToken, hasClerk: true }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children, onClaimSuccess }) {
  const hasClerk = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

  if (!hasClerk) {
    return (
      <AuthContext.Provider
        value={{
          isLoaded: true,
          isSignedIn: false,
          user: null,
          getToken: async () => null,
          hasClerk: false,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <ClerkInnerAuthProvider onClaimSuccess={onClaimSuccess}>
      {children}
    </ClerkInnerAuthProvider>
  );
}

export const useLynqAuth = () => useContext(AuthContext);

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export const STORAGE_KEY_AUTH_USER = 'linguaflow_user_account';

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  loginWithGoogle: async () => {},
  logout: () => {},
  clearError: () => {}
});

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AUTH_USER);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && parsed.email) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved user account from localStorage:', e);
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEY_AUTH_USER);
      }
    } catch (e) {
      console.warn('Failed to persist user session:', e);
    }
  }, [user]);

  useEffect(() => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!googleClientId) return;

    if (document.getElementById('google-client-script')) return;

    const script = document.createElement('script');
    script.id = 'google-client-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (googleClientId && window.google?.accounts?.id) {
      try {
        await new Promise((resolve, reject) => {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: (response) => {
              try {
                if (response.credential) {
                  const payload = parseJwt(response.credential);
                  if (payload) {
                    const loggedUser = {
                      uid: payload.sub || `google-${Date.now()}`,
                      displayName: payload.name || payload.given_name || 'Google User',
                      email: payload.email || '',
                      photoURL: payload.picture || '',
                      provider: 'google',
                      createdAt: new Date().toISOString()
                    };
                    setUser(loggedUser);
                    resolve(loggedUser);
                    return;
                  }
                }
                reject(new Error('No se pudo verificar el token de Google.'));
              } catch (err) {
                reject(err);
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true
          });

          window.google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              console.log('Google prompt not displayed or skipped:', notification.getNotDisplayedReason());
            }
          });
        });
      } catch (err) {
        console.warn('Google Identity error, using fallback session:', err);
        setError(err.message || 'Error al conectar con Google.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      await new Promise((res) => setTimeout(res, 500));

      const demoUser = {
        uid: 'demo-google-uid-1001',
        displayName: 'Estudiante de LinguaFlow',
        email: 'lingua.learner@gmail.com',
        photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&auto=format&fit=crop&q=80',
        provider: 'google',
        createdAt: new Date().toISOString()
      };

      setUser(demoUser);
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY_AUTH_USER);
      if (window.google?.accounts?.id) {
        window.google.accounts.id.disableAutoSelect();
      }
    } catch (e) {}
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = {
    user,
    isAuthenticated: Boolean(user && user.email),
    isLoading,
    error,
    loginWithGoogle,
    logout,
    clearError
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

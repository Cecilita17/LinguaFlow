import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../services/chatService.js';

export const STORAGE_KEY_AUTH_TOKEN = 'linguaflow_session_token';

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  loginWithGoogle: async () => {},
  logout: async () => {},
  clearError: () => {}
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const tokenClientRef = useRef(null);

  const clearError = useCallback(() => setError(null), []);

  // 1. Verify and restore real session on initial load or refresh from backend
  const verifySessionOnMount = useCallback(async () => {
    try {
      const storedToken = localStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
      if (!storedToken) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Query the backend endpoint /api/auth/me to cryptographically verify token
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${storedToken}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
          setUser(null);
        }
      } else {
        localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
        setUser(null);
      }
    } catch (e) {
      console.warn('Session verification notice:', e);
      // If server unreachable or error, do not assume authenticated
      localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    verifySessionOnMount();
  }, [verifySessionOnMount]);

  // 2. Exchange Google token with backend for real verification and session creation
  const handleVerifyWithBackend = useCallback(async ({ credential, accessToken }) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ credential, accessToken })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Error al verificar la cuenta con el servidor.');
      }

      // Save real server-issued session token
      if (data.token) {
        localStorage.setItem(STORAGE_KEY_AUTH_TOKEN, data.token);
      }
      setUser(data.user);
      return data.user;
    } catch (err) {
      console.error('Backend verification error:', err);
      setError(err.message || 'Error al autenticar con el servidor.');
      setUser(null);
      localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 3. Real Google OAuth login flow triggered explicitly by user click
  const loginWithGoogle = useCallback(async () => {
    setError(null);
    const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

    // Check configuration
    if (!googleClientId) {
      const configMsg = 'Google Client ID no está configurado. Por favor configura VITE_GOOGLE_CLIENT_ID en tu archivo .env.';
      console.error(configMsg);
      setError(configMsg);
      return;
    }

    if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
      // If oauth2 client is not yet loaded, wait briefly or report error
      const notLoadedMsg = 'El servicio de Google Identity no está disponible en este momento. Revisa tu conexión a internet.';
      console.error(notLoadedMsg);
      setError(notLoadedMsg);
      return;
    }

    setIsLoading(true);

    try {
      // Use Google OAuth2 Code/Token flow with standard popup window
      await new Promise((resolve, reject) => {
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: googleClientId,
            scope: 'openid email profile',
            callback: async (tokenResponse) => {
              if (tokenResponse.error) {
                console.error('Google OAuth error:', tokenResponse);
                if (tokenResponse.error === 'popup_closed_by_user' || tokenResponse.error === 'access_denied') {
                  // User cancelled
                  reject(new Error('Inicio de sesión cancelado por el usuario.'));
                } else {
                  reject(new Error(`Error de Google OAuth: ${tokenResponse.error_description || tokenResponse.error}`));
                }
                return;
              }

              if (!tokenResponse.access_token) {
                reject(new Error('No se recibió el token de acceso de Google.'));
                return;
              }

              try {
                // Send access token to backend for verification
                const verifiedUser = await handleVerifyWithBackend({ accessToken: tokenResponse.access_token });
                resolve(verifiedUser);
              } catch (backendErr) {
                reject(backendErr);
              }
            },
            error_callback: (err) => {
              console.error('Google token client error callback:', err);
              reject(new Error(err.message || 'No se pudo abrir la ventana de inicio de sesión de Google.'));
            }
          });

          tokenClientRef.current = client;
          // Prompt user with Google Account Selector popup
          client.requestAccessToken({ prompt: 'select_account' });
        } catch (initErr) {
          reject(initErr);
        }
      });
    } catch (err) {
      console.warn('Google login failed or cancelled:', err.message);
      setError(err.message || 'No se pudo completar el inicio de sesión.');
    } finally {
      setIsLoading(false);
    }
  }, [handleVerifyWithBackend]);

  // 4. Real Logout
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedToken = localStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
      if (storedToken) {
        try {
          await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${storedToken}`
            }
          });
        } catch (e) {
          // Non-blocking network catch on logout
        }
      }
    } finally {
      // Clear token and state immediately
      localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
      setUser(null);
      setError(null);
      setIsLoading(false);
    }
  }, []);

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

import dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

dotenv.config();

function getJwtSecret() {
  return process.env.JWT_SECRET || process.env.SESSION_SECRET || 'linguaflow-super-secret-session-key-2026';
}

export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function parseRequestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  return req.body;
}

function getGoogleClientId() {
  return (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim();
}

/**
 * Handle POST /api/auth/google
 * Verifies the Google ID Token or Access Token and returns a signed session token + user profile.
 */
export async function handleGoogleAuth(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { credential, accessToken } = parseRequestBody(req);

    if (!credential && !accessToken) {
      return res.status(400).json({
        error: 'missing_credential',
        message: 'No se recibió ninguna credencial o token de Google.'
      });
    }

    const clientId = getGoogleClientId();
    let verifiedPayload = null;

    if (credential) {
      // Flow 1: Google ID Token verification
      const client = new OAuth2Client(clientId || undefined);
      try {
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: clientId ? [clientId] : undefined
        });
        verifiedPayload = ticket.getPayload();
      } catch (verifyErr) {
        console.error('Google ID token verification failed:', verifyErr.message);
        return res.status(401).json({
          error: 'invalid_token',
          message: 'El token de Google no es válido o ha expirado. Por favor intenta iniciar sesión de nuevo.'
        });
      }
    } else if (accessToken) {
      // Flow 2: Access token verification via Google userinfo endpoint
      try {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!userInfoRes.ok) {
          return res.status(401).json({
            error: 'invalid_token',
            message: 'El token de acceso de Google no es válido.'
          });
        }
        verifiedPayload = await userInfoRes.json();
      } catch (fetchErr) {
        console.error('Google userinfo fetch failed:', fetchErr.message);
        return res.status(401).json({
          error: 'network_error',
          message: 'Error al contactar los servidores de autenticación de Google.'
        });
      }
    }

    if (!verifiedPayload || (!verifiedPayload.sub && !verifiedPayload.id)) {
      return res.status(401).json({
        error: 'verification_failed',
        message: 'No se pudo obtener la identidad del usuario desde Google.'
      });
    }

    const googleUid = verifiedPayload.sub || verifiedPayload.id;
    const user = {
      uid: `google:${googleUid}`,
      email: verifiedPayload.email || '',
      displayName: verifiedPayload.name || verifiedPayload.given_name || 'Google User',
      photoURL: verifiedPayload.picture || '',
      provider: 'google',
      emailVerified: Boolean(verifiedPayload.email_verified)
    };

    // Sign a cryptographically verified server session JWT (valid for 30 days)
    const sessionToken = jwt.sign(
      {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        provider: user.provider
      },
      getJwtSecret(),
      { expiresIn: '30d' }
    );

    return res.json({
      success: true,
      token: sessionToken,
      user
    });
  } catch (err) {
    console.error('handleGoogleAuth unexpected error:', err);
    return res.status(500).json({
      error: 'server_error',
      message: 'Error interno del servidor al procesar la autenticación.'
    });
  }
}

/**
 * Handle GET /api/auth/me
 * Validates the server session token and returns the current user profile.
 */
export async function handleGetSession(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

    if (!token) {
      return res.status(401).json({
        authenticated: false,
        user: null,
        error: 'no_session'
      });
    }

    try {
      const decoded = jwt.verify(token, getJwtSecret());
      return res.json({
        authenticated: true,
        user: {
          uid: decoded.uid,
          email: decoded.email,
          displayName: decoded.displayName,
          photoURL: decoded.photoURL,
          provider: decoded.provider
        }
      });
    } catch (jwtErr) {
      return res.status(401).json({
        authenticated: false,
        user: null,
        error: 'invalid_or_expired_session'
      });
    }
  } catch (err) {
    console.error('handleGetSession unexpected error:', err);
    return res.status(500).json({
      error: 'server_error',
      message: 'Error al verificar la sesión actual.'
    });
  }
}

/**
 * Handle POST /api/auth/logout
 */
export async function handleLogout(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  return res.json({
    success: true,
    message: 'Sesión cerrada correctamente.'
  });
}

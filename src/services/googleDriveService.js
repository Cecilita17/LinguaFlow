/**
 * src/services/googleDriveService.js
 * 
 * Manages Google Drive OAuth authorization and API interactions for LinguaFlow manual backups.
 * 
 * Scope: 'https://www.googleapis.com/auth/drive.file'
 * Least-privilege scope recommended by Google: only grants LinguaFlow access to files
 * and folders created by LinguaFlow itself. Never accesses or touches user personal files.
 */

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const BACKUP_FOLDER_NAME = 'LinguaFlow Backups';

// Storage keys
const STORAGE_KEY_DRIVE_TOKEN = 'linguaflow_drive_access_token';
const STORAGE_KEY_DRIVE_EXPIRES = 'linguaflow_drive_token_expires_at';
const STORAGE_KEY_DRIVE_AUTHORIZED = 'linguaflow_drive_authorized';
const STORAGE_KEY_DRIVE_USER = 'linguaflow_drive_authorized_user';

// In-memory cache of access token
let cachedDriveToken = null;
let cachedExpiresAt = 0;
let inFlightTokenPromise = null;

const connectionListeners = new Set();

/**
 * Subscribes a listener to Drive connection changes.
 * @param {function(boolean): void} listener
 * @returns {function(): void} Unsubscribe callback
 */
export function onDriveConnectionChanged(listener) {
  if (typeof listener === 'function') {
    connectionListeners.add(listener);
  }
  return () => {
    connectionListeners.delete(listener);
  };
}

function notifyConnectionChanged() {
  const connected = isDriveConnected();
  connectionListeners.forEach(fn => {
    try { fn(connected); } catch (e) {}
  });
}

/**
 * Checks whether the user has previously authorized Google Drive in LinguaFlow.
 * Persists in localStorage across browser sessions.
 * 
 * @param {string} [userEmail]
 * @returns {boolean}
 */
export function isDriveAuthorized(userEmail = '') {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const authorized = localStorage.getItem(STORAGE_KEY_DRIVE_AUTHORIZED) === 'true';
      if (!authorized) return false;
      if (userEmail) {
        const storedUser = localStorage.getItem(STORAGE_KEY_DRIVE_USER);
        if (storedUser && storedUser.toLowerCase() !== userEmail.toLowerCase()) {
          return false;
        }
      }
      return true;
    }
  } catch (e) {}
  return false;
}

/**
 * Records that the user has authorized Google Drive.
 */
function setDriveAuthorized(userEmail = '') {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY_DRIVE_AUTHORIZED, 'true');
      if (userEmail) {
        localStorage.setItem(STORAGE_KEY_DRIVE_USER, userEmail);
      }
    }
  } catch (e) {}
}

/**
 * Clears all stored tokens and authorization flags.
 */
function clearDriveStorage() {
  try {
    if (typeof window !== 'undefined') {
      if (window.localStorage) {
        localStorage.removeItem(STORAGE_KEY_DRIVE_AUTHORIZED);
        localStorage.removeItem(STORAGE_KEY_DRIVE_USER);
        localStorage.removeItem(STORAGE_KEY_DRIVE_TOKEN);
        localStorage.removeItem(STORAGE_KEY_DRIVE_EXPIRES);
      }
      if (window.sessionStorage) {
        sessionStorage.removeItem(STORAGE_KEY_DRIVE_TOKEN);
        sessionStorage.removeItem(STORAGE_KEY_DRIVE_EXPIRES);
      }
    }
  } catch (e) {}
}

/**
 * Attempts to load an unexpired access token from memory or local storage.
 * @returns {string|null} Valid access token, or null if expired/missing
 */
function loadStoredToken() {
  const now = Date.now();
  if (cachedDriveToken && cachedExpiresAt > now + 60000) {
    return cachedDriveToken;
  }

  try {
    if (typeof window !== 'undefined') {
      // Check localStorage first, fallback to sessionStorage
      const token = (window.localStorage && localStorage.getItem(STORAGE_KEY_DRIVE_TOKEN)) ||
                    (window.sessionStorage && sessionStorage.getItem(STORAGE_KEY_DRIVE_TOKEN));
      const expiresStr = (window.localStorage && localStorage.getItem(STORAGE_KEY_DRIVE_EXPIRES)) ||
                         (window.sessionStorage && sessionStorage.getItem(STORAGE_KEY_DRIVE_EXPIRES));
      const expires = parseInt(expiresStr || '0', 10);

      if (token && expires > now + 60000) {
        cachedDriveToken = token;
        cachedExpiresAt = expires;
        return token;
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Saves access token in memory and storage (localStorage + sessionStorage).
 */
function persistToken(token, expiresAt, userEmail = '') {
  cachedDriveToken = token;
  cachedExpiresAt = expiresAt;

  setDriveAuthorized(userEmail);

  try {
    if (typeof window !== 'undefined') {
      if (window.localStorage) {
        localStorage.setItem(STORAGE_KEY_DRIVE_TOKEN, token);
        localStorage.setItem(STORAGE_KEY_DRIVE_EXPIRES, String(expiresAt));
      }
      if (window.sessionStorage) {
        sessionStorage.setItem(STORAGE_KEY_DRIVE_TOKEN, token);
        sessionStorage.setItem(STORAGE_KEY_DRIVE_EXPIRES, String(expiresAt));
      }
    }
  } catch (e) {}
}

/**
 * Checks if a valid, unexpired Google Drive access token is currently available.
 * Does not check just for an arbitrary string; verifies expiration > current time.
 * 
 * @returns {boolean}
 */
export function isDriveConnected() {
  return Boolean(loadStoredToken());
}

/**
 * Disconnects Google Drive: revokes token if possible, clears in-memory and local storage state,
 * and notifies listeners. Ensures LinguaFlow will NOT attempt silent reconnection.
 */
export function disconnectDrive() {
  const tokenToRevoke = cachedDriveToken || (typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(STORAGE_KEY_DRIVE_TOKEN) : null);

  cachedDriveToken = null;
  cachedExpiresAt = 0;
  clearDriveStorage();

  // Best-effort token revocation with Google Identity Services
  if (tokenToRevoke && typeof window !== 'undefined' && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(tokenToRevoke, () => {
        console.log('[GoogleDrive] Token revoked successfully.');
      });
    } catch (e) {
      console.warn('[GoogleDrive] Notice revoking token with Google:', e);
    }
  }

  notifyConnectionChanged();
}

/**
 * Waits for the Google Identity Services client script to load if not already ready.
 */
async function waitForGoogleIdentityServices() {
  if (typeof window === 'undefined') {
    throw new Error('Google Identity Services no está disponible en este entorno.');
  }
  if (window.google?.accounts?.oauth2) {
    return true;
  }

  return new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.google?.accounts?.oauth2) {
        clearInterval(interval);
        resolve(true);
      } else if (attempts >= 30) {
        clearInterval(interval);
        reject(new Error('Google Identity Services no está disponible en este momento.'));
      }
    }, 100);
  });
}

/**
 * Performs an OAuth token request via Google Identity Services TokenClient.
 * 
 * @param {string} clientId
 * @param {string} userEmail
 * @param {string} prompt - '' for silent renewal without consent screen, or 'consent'
 * @returns {Promise<{ token: string, expiresAt: number }>}
 */
function requestGisToken(clientId, userEmail, prompt) {
  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_FILE_SCOPE,
        hint: userEmail || undefined,
        callback: (tokenResponse) => {
          if (tokenResponse.error) {
            const errCode = tokenResponse.error;
            if (errCode === 'popup_closed_by_user' || errCode === 'access_denied') {
              reject(new Error('Autorización de Google Drive cancelada por el usuario.'));
            } else if (errCode === 'interaction_required' || errCode === 'consent_required') {
              reject(new Error('Se requiere interacción del usuario para renovar el acceso a Google Drive.'));
            } else {
              reject(new Error(`Error de autorización: ${tokenResponse.error_description || errCode}`));
            }
            return;
          }

          if (!tokenResponse.access_token) {
            reject(new Error('No se recibió el token de acceso para Google Drive.'));
            return;
          }

          const token = tokenResponse.access_token;
          const expiresInSeconds = parseInt(tokenResponse.expires_in || '3599', 10);
          const expiresAt = Date.now() + expiresInSeconds * 1000;

          resolve({ token, expiresAt });
        },
        error_callback: (err) => {
          console.warn('[GoogleDrive] Token client error callback:', err);
          reject(new Error(err?.message || 'Error en cliente de autorización de Google.'));
        }
      });

      tokenClient.requestAccessToken({
        prompt,
        hint: userEmail || undefined
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Requests an access token with the drive.file scope using Google Identity Services.
 * - Reuses existing valid token if unexpired.
 * - If expired or opening across sessions, attempts silent renewal (prompt: '') if previously authorized.
 * - Never prompts consent popup automatically on app launch.
 * - Falls back to interactive prompt only when user interaction is allowed and required.
 * 
 * @param {string} [userEmail=''] - Hint for account selection
 * @param {object} [options={}]
 * @param {boolean} [options.silentOnly=false] - If true, never opens a popup; fails silently if interaction required
 * @param {boolean} [options.forceConsent=false] - If true, forces consent screen (e.g. user explicitly clicking connect)
 * @returns {Promise<string>} Valid access token
 */
export async function requestDriveAccessToken(userEmail = '', options = {}) {
  const { silentOnly = false, forceConsent = false } = options;

  // 1. If valid unexpired token exists, return it immediately
  const existingToken = loadStoredToken();
  if (existingToken && !forceConsent) {
    return existingToken;
  }

  // 2. Concurrency lock: reuse in-flight token request
  if (inFlightTokenPromise) {
    return inFlightTokenPromise;
  }

  inFlightTokenPromise = (async () => {
    try {
      const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
      if (!clientId) {
        throw new Error('VITE_GOOGLE_CLIENT_ID no está configurado.');
      }

      await waitForGoogleIdentityServices();

      const previouslyAuthorized = isDriveAuthorized(userEmail);

      // Attempt silent renewal if previously authorized and not forcing consent
      if (previouslyAuthorized && !forceConsent) {
        try {
          const silentResult = await requestGisToken(clientId, userEmail, '');
          persistToken(silentResult.token, silentResult.expiresAt, userEmail);
          notifyConnectionChanged();
          return silentResult.token;
        } catch (silentErr) {
          console.warn('[GoogleDrive] Silent renewal notice:', silentErr?.message || silentErr);
          if (silentOnly) {
            throw silentErr;
          }
          // Fall through to interactive prompt if interaction is allowed
        }
      } else if (silentOnly) {
        throw new Error('Google Drive no está autorizado previamente para renovación silenciosa.');
      }

      // Interactive request: opens OAuth popup
      const promptOption = forceConsent || !previouslyAuthorized ? 'consent' : '';
      const interactiveResult = await requestGisToken(clientId, userEmail, promptOption);
      persistToken(interactiveResult.token, interactiveResult.expiresAt, userEmail);
      notifyConnectionChanged();
      return interactiveResult.token;
    } finally {
      inFlightTokenPromise = null;
    }
  })();

  return inFlightTokenPromise;
}

/**
 * Silently restores Google Drive connection if user previously authorized it.
 * Never displays a consent prompt or popup window.
 * 
 * @param {string} [userEmail='']
 * @returns {Promise<boolean>} True if connection is active/restored, false otherwise
 */
export async function restoreDriveConnectionSilently(userEmail = '') {
  if (isDriveConnected()) {
    return true;
  }
  if (!isDriveAuthorized(userEmail)) {
    return false;
  }

  try {
    const token = await requestDriveAccessToken(userEmail, { silentOnly: true });
    return Boolean(token);
  } catch (err) {
    return false;
  }
}

/**
 * Finds or creates the "LinguaFlow Backups" folder in the user's Google Drive.
 * 
 * @param {string} accessToken
 * @returns {Promise<string>} Folder ID
 */
export async function getOrCreateBackupFolder(accessToken) {
  const query = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and name = '${BACKUP_FOLDER_NAME}' and trashed = false`);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`Error al buscar carpeta en Google Drive: ${errText}`);
  }

  const searchData = await searchRes.json();
  if (Array.isArray(searchData.files) && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Error al crear carpeta en Google Drive: ${errText}`);
  }

  const folderData = await createRes.json();
  return folderData.id;
}

/**
 * Uploads a backup JSON payload to the "LinguaFlow Backups" folder.
 * Accepts both Blob and string inputs.
 * Uses Google Drive Resumable Upload for large payloads (>4MB) and Multipart Blob upload for smaller payloads,
 * completely avoiding giant string concatenations and V8 string length limits.
 * 
 * @param {string} accessToken
 * @param {string} folderId
 * @param {string} fileName
 * @param {Blob|string} fileData
 * @returns {Promise<object>} Uploaded file metadata
 */
export async function uploadBackupFile(accessToken, folderId, fileName, fileData) {
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: [folderId],
    description: 'LinguaFlow manual backup containing user learning history, library, and settings.'
  };

  const blob = (typeof Blob !== 'undefined' && fileData instanceof Blob)
    ? fileData
    : new Blob([fileData], { type: 'application/json' });

  // For payloads > 4MB, use Google Drive Resumable Upload protocol (streams blob natively)
  if (blob.size > 4 * 1024 * 1024) {
    return await uploadResumableFile(accessToken, folderId, metadata, blob);
  }

  // For standard payloads, use Multipart upload via Blob parts (no string concatenation)
  const boundary = '-------LinguaFlowBackupBoundary' + Math.random().toString(36).substring(2);
  const metadataPart = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`
  ], { type: 'text/plain' });

  const closePart = new Blob([`\r\n--${boundary}--`], { type: 'text/plain' });

  const multipartBlob = new Blob([metadataPart, blob, closePart], {
    type: `multipart/related; boundary=${boundary}`
  });

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime';

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartBlob
  });

  if (!uploadRes.ok) {
    if (uploadRes.status === 403 || uploadRes.status === 507) {
      throw new Error('No hay suficiente espacio de almacenamiento o permisos en Google Drive para completar la copia.');
    }
    const errText = await uploadRes.text();
    throw new Error(`Error al subir archivo a Google Drive (${uploadRes.status}): ${errText}`);
  }

  return await uploadRes.json();
}

/**
 * Resumable upload for large backup files without multipart encoding overhead.
 */
async function uploadResumableFile(accessToken, folderId, metadata, blob) {
  const initUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,createdTime';

  const initRes = await fetch(initUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'application/json',
      'X-Upload-Content-Length': String(blob.size)
    },
    body: JSON.stringify(metadata)
  });

  if (!initRes.ok) {
    if (initRes.status === 403 || initRes.status === 507) {
      throw new Error('No hay suficiente espacio disponible en tu cuenta de Google Drive para este backup.');
    }
    const errText = await initRes.text();
    throw new Error(`Error al iniciar subida en Google Drive: ${errText}`);
  }

  const locationUrl = initRes.headers.get('Location');
  if (!locationUrl) {
    throw new Error('Google Drive no devolvió la URL de sesión de subida.');
  }

  const uploadRes = await fetch(locationUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: blob
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Error durante la transferencia de datos a Google Drive: ${errText}`);
  }

  return await uploadRes.json();
}

/**
 * Lists all backup files inside the "LinguaFlow Backups" folder, newest first.
 * 
 * @param {string} accessToken
 * @param {string} folderId
 * @returns {Promise<Array<object>>} List of backup file objects
 */
export async function listBackupFiles(accessToken, folderId) {
  const query = encodeURIComponent(`'${folderId}' in parents and mimeType = 'application/json' and trashed = false`);
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=createdTime desc&fields=files(id,name,size,createdTime,modifiedTime)&pageSize=30`;

  const res = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al listar backups en Google Drive: ${errText}`);
  }

  const data = await res.json();
  return Array.isArray(data.files) ? data.files : [];
}

/**
 * Downloads and parses backup JSON payload directly from Google Drive response stream.
 * 
 * @param {string} accessToken
 * @param {string} fileId
 * @returns {Promise<object>} Parsed payload
 */
export async function downloadBackupPayload(accessToken, fileId) {
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al descargar el backup de Google Drive: ${errText}`);
  }

  return await res.json();
}

/**
 * Downloads a backup file's raw content by its Google Drive file ID as text.
 * Maintained for backward compatibility.
 * 
 * @param {string} accessToken
 * @param {string} fileId
 * @returns {Promise<string>} Downloaded JSON content string
 */
export async function downloadBackupContent(accessToken, fileId) {
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al descargar el backup de Google Drive: ${errText}`);
  }

  return await res.text();
}

/**
 * Deletes a backup file from Google Drive by its file ID.
 * Used for auto-backup retention policy cleanup after confirming a new upload.
 *
 * @param {string} accessToken
 * @param {string} fileId
 * @returns {Promise<boolean>}
 */
export async function deleteDriveFile(accessToken, fileId) {
  if (!accessToken || !fileId) return false;
  const deleteUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`;

  try {
    const res = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok && res.status !== 404) {
      const errText = await res.text();
      console.warn(`[GoogleDriveService] Failed to delete file ${fileId}:`, errText);
      return false;
    }

    return true;
  } catch (err) {
    console.warn(`[GoogleDriveService] Exception deleting file ${fileId}:`, err);
    return false;
  }
}

export const AUTO_BACKUP_SUBFOLDER_NAME = 'auto';

/**
 * Gets or creates the "auto" subfolder inside the "LinguaFlow Backups" folder.
 * 
 * @param {string} accessToken
 * @param {string} parentFolderId
 * @returns {Promise<string>} Subfolder ID
 */
export async function getOrCreateAutoBackupFolder(accessToken, parentFolderId) {
  const query = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and name = '${AUTO_BACKUP_SUBFOLDER_NAME}' and '${parentFolderId}' in parents and trashed = false`);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`Error al buscar subcarpeta de auto-backup en Google Drive: ${errText}`);
  }

  const searchData = await searchRes.json();
  if (Array.isArray(searchData.files) && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create "auto" subfolder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: AUTO_BACKUP_SUBFOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId]
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Error al crear subcarpeta de auto-backup en Google Drive: ${errText}`);
  }

  const folderData = await createRes.json();
  return folderData.id;
}

/**
 * Finds a file by name inside a specific folder.
 * 
 * @param {string} accessToken
 * @param {string} folderId
 * @param {string} fileName
 * @returns {Promise<object|null>} File metadata { id, name, size, modifiedTime } or null
 */
export async function findDriveFile(accessToken, folderId, fileName) {
  if (!accessToken || !folderId || !fileName) return null;
  const escapedName = fileName.replace(/'/g, "\\'");
  const query = encodeURIComponent(`'${folderId}' in parents and name = '${escapedName}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,size,modifiedTime)&spaces=drive&pageSize=1`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  return (Array.isArray(data.files) && data.files.length > 0) ? data.files[0] : null;
}

/**
 * Lists all files inside a specific folder.
 * 
 * @param {string} accessToken
 * @param {string} folderId
 * @returns {Promise<Array<object>>}
 */
export async function listFolderFiles(accessToken, folderId) {
  if (!accessToken || !folderId) return [];
  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,size,modifiedTime)&pageSize=1000`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al listar archivos de carpeta en Google Drive: ${errText}`);
  }

  const data = await res.json();
  return Array.isArray(data.files) ? data.files : [];
}

/**
 * Uploads a new resource file to a designated folder in Google Drive.
 * 
 * @param {string} accessToken
 * @param {string} folderId
 * @param {string} fileName
 * @param {Blob|string} fileData
 * @returns {Promise<object>} Uploaded file metadata
 */
export async function uploadDriveResource(accessToken, folderId, fileName, fileData) {
  return await uploadBackupFile(accessToken, folderId, fileName, fileData);
}

/**
 * Updates an existing file's content in Google Drive by its fileId using PATCH.
 * Completely replaces content without creating duplicates or changing file ID.
 * 
 * @param {string} accessToken
 * @param {string} fileId
 * @param {Blob|string} fileData
 * @returns {Promise<object>} Updated file metadata
 */
export async function updateDriveResource(accessToken, fileId, fileData) {
  if (!accessToken || !fileId) {
    throw new Error('Parámetros inválidos para actualizar recurso en Google Drive.');
  }

  const blob = (typeof Blob !== 'undefined' && fileData instanceof Blob)
    ? fileData
    : new Blob([fileData], { type: 'application/json' });

  // For large payloads (>4MB), use resumable PATCH
  if (blob.size > 4 * 1024 * 1024) {
    return await updateResumableDriveResource(accessToken, fileId, blob);
  }

  const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,size,modifiedTime`;

  const updateRes = await fetch(updateUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: blob
  });

  if (!updateRes.ok) {
    if (updateRes.status === 403 || updateRes.status === 507) {
      throw new Error('Espacio insuficiente o permisos denegados en Google Drive.');
    }
    const errText = await updateRes.text();
    throw new Error(`Error al actualizar recurso en Google Drive (${updateRes.status}): ${errText}`);
  }

  return await updateRes.json();
}

/**
 * Resumable PATCH for large files.
 */
async function updateResumableDriveResource(accessToken, fileId, blob) {
  const initUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=resumable&fields=id,name,size,modifiedTime`;

  const initRes = await fetch(initUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'application/json',
      'X-Upload-Content-Length': String(blob.size)
    }
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`Error al iniciar actualización resumable en Google Drive: ${errText}`);
  }

  const locationUrl = initRes.headers.get('Location');
  if (!locationUrl) {
    throw new Error('Google Drive no devolvió la URL de sesión de actualización.');
  }

  const uploadRes = await fetch(locationUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: blob
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Error durante la actualización resumable en Google Drive: ${errText}`);
  }

  return await uploadRes.json();
}

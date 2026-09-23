/**
 * src/services/googleDriveService.js
 * 
 * Manages Google Drive OAuth authorization and API interactions for LinguaFlow manual backups.
 * 
 * Scope: 'https://www.googleapis.com/auth/drive.file'
 * Least-privilege scope recommended by Google: only grants LinguaFlow access to files
 * and folders created by LinguaFlow itself. Never accesses or touches user personal files.
 */

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const BACKUP_FOLDER_NAME = 'LinguaFlow Backups';
const STORAGE_KEY_DRIVE_TOKEN = 'linguaflow_drive_access_token';
const STORAGE_KEY_DRIVE_EXPIRES = 'linguaflow_drive_token_expires_at';

// In-memory cache of access token
let cachedDriveToken = null;
let cachedExpiresAt = 0;

/**
 * Check if the stored Google Drive token is still valid.
 */
export function isDriveConnected() {
  const now = Date.now();
  if (cachedDriveToken && cachedExpiresAt > now + 60000) {
    return true;
  }
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = sessionStorage.getItem(STORAGE_KEY_DRIVE_TOKEN);
      const expires = parseInt(sessionStorage.getItem(STORAGE_KEY_DRIVE_EXPIRES) || '0', 10);
      if (stored && expires > now + 60000) {
        cachedDriveToken = stored;
        cachedExpiresAt = expires;
        return true;
      }
    }
  } catch (e) {}
  return false;
}

/**
 * Clear Drive token state (e.g. on logout or disconnect)
 */
export function disconnectDrive() {
  cachedDriveToken = null;
  cachedExpiresAt = 0;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem(STORAGE_KEY_DRIVE_TOKEN);
      sessionStorage.removeItem(STORAGE_KEY_DRIVE_EXPIRES);
    }
  } catch (e) {}
}

/**
 * Requests an access token with the drive.file scope using Google Identity Services.
 * Reuses the existing Google Client ID configured in LinguaFlow.
 * 
 * @param {string} userEmail - Hint for account selection
 * @returns {Promise<string>} Valid access token
 */
export async function requestDriveAccessToken(userEmail = '') {
  if (isDriveConnected() && cachedDriveToken) {
    return cachedDriveToken;
  }

  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID no está configurado.');
  }

  if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
    // Wait up to 2.5s for Google Identity Services script
    const isLoaded = await new Promise((resolve) => {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.google?.accounts?.oauth2) {
          clearInterval(interval);
          resolve(true);
        } else if (attempts >= 25) {
          clearInterval(interval);
          resolve(false);
        }
      }, 100);
    });

    if (!isLoaded) {
      throw new Error('Google Identity Services no está disponible en este momento.');
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_FILE_SCOPE,
        hint: userEmail || undefined,
        callback: (tokenResponse) => {
          if (tokenResponse.error) {
            console.error('Drive OAuth error:', tokenResponse);
            if (tokenResponse.error === 'popup_closed_by_user' || tokenResponse.error === 'access_denied') {
              reject(new Error('Autorización de Google Drive cancelada por el usuario.'));
            } else {
              reject(new Error(`Error de autorización: ${tokenResponse.error_description || tokenResponse.error}`));
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

          cachedDriveToken = token;
          cachedExpiresAt = expiresAt;

          try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
              sessionStorage.setItem(STORAGE_KEY_DRIVE_TOKEN, token);
              sessionStorage.setItem(STORAGE_KEY_DRIVE_EXPIRES, String(expiresAt));
            }
          } catch (e) {}

          resolve(token);
        },
        error_callback: (err) => {
          console.error('Drive token client error callback:', err);
          reject(new Error(err.message || 'No se pudo abrir la ventana de autorización de Google Drive.'));
        }
      });

      tokenClient.requestAccessToken({ prompt: isDriveConnected() ? '' : 'consent' });
    } catch (err) {
      reject(err);
    }
  });
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

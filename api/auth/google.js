import { handleGoogleAuth } from '../../server/authHandlers.js';

export default async function handler(req, res) {
  return handleGoogleAuth(req, res);
}

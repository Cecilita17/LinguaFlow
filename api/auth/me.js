import { handleGetSession } from '../../server/authHandlers.js';

export default async function handler(req, res) {
  return handleGetSession(req, res);
}

import { handleLogout } from '../../server/authHandlers.js';

export default async function handler(req, res) {
  return handleLogout(req, res);
}

import { handleHealth } from '../server/handlers.js';

export default async function handler(req, res) {
  return handleHealth(req, res);
}

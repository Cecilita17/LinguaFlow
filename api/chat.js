import { handleChat } from '../server/handlers.js';

export default async function handler(req, res) {
  return handleChat(req, res);
}

import { handleLanguages } from '../server/handlers.js';

export default async function handler(req, res) {
  return handleLanguages(req, res);
}

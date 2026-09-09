import { handleLookupWord } from '../server/handlers.js';

export default async function handler(req, res) {
  return handleLookupWord(req, res);
}

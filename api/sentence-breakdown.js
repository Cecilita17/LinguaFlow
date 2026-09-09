import { handleSentenceBreakdown } from '../server/handlers.js';

export default async function handler(req, res) {
  return handleSentenceBreakdown(req, res);
}

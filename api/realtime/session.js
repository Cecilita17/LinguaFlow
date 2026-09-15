import { handleRealtimeSession } from '../../server/realtimeHandlers.js';

export default async function handler(req, res) {
  return handleRealtimeSession(req, res);
}

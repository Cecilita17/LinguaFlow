import { handleBatchGloss } from '../server/handlers.js';

export default async function handler(req, res) {
  return handleBatchGloss(req, res);
}

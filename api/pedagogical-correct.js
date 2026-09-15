import { handlePedagogicalCorrect } from '../server/handlers.js';

export default async function handler(req, res) {
  return handlePedagogicalCorrect(req, res);
}

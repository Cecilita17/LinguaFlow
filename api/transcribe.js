import { handleTranscribe } from '../server/handlers.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default async function handler(req, res) {
  return handleTranscribe(req, res);
}

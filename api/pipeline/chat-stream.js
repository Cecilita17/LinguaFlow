import { handlePipelineChatStream } from '../../server/pipelineHandlers.js';

export default async function handler(req, res) {
  return handlePipelineChatStream(req, res);
}

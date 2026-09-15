import { handlePipelineTTS } from '../../server/pipelineHandlers.js';

export default async function handler(req, res) {
  return handlePipelineTTS(req, res);
}

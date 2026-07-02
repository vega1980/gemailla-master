import { firebase, invokeLLM } from '@/api/firebaseClient';
import agentClient from '@/api/agentClient';

export async function askLLM(params) {
  return invokeLLM(params);
}

export const aiService = {
  askLLM,
  invokeLLM: askLLM,
  agents: {
    ...firebase.agents,
    ...agentClient,
  },
};

export default aiService;

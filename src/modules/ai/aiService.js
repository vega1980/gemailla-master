import { firebase } from '@/api/firebaseClient';

export const aiService = {
  invokeLLM: firebase.integrations.Core.InvokeLLM,
  agents: firebase.agents,
};
export default aiService;

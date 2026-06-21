export { auth } from '@/firebase';

export const getCurrentUser = () => auth.currentUser;
export const signOut = (...args) => auth.signOut(...args);

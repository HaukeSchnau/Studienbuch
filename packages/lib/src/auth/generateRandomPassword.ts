/**
 * This is NOT cryptographically secure, but it's good enough for the web app
 */
export const generateRandomPassword = () => {
  return Math.random().toString(36).slice(2);
};

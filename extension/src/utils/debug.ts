/**
 * Check if debug mode is enabled from environment variables
 */
export const isDebugMode = (): boolean => {
  return process.env.REACT_APP_IS_DEBUG === 'true';
};

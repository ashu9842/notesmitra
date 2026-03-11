/**
 * Global Console Suppression System
 * Ensures NO console output is displayed to the user
 * All LOG RECORDS are sent to the logger instead
 */

import logger from './logger.js';

/**
 * Suppress all console output (development + production)
 * Redirect to logger for persistence
 */
export const suppressConsoleOutput = () => {
  // Store original methods for potential debugging
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  const originalDebug = console.debug;

  // Override all console methods to suppress output
  console.log = (...args) => {
    const message = args.join(' ');
    logger.debug(message);
    // No console output
  };

  console.error = (...args) => {
    const message = args.join(' ');
    logger.error(message);
    // No console output
  };

  console.warn = (...args) => {
    const message = args.join(' ');
    logger.warn(message);
    // No console output
  };

  console.info = (...args) => {
    const message = args.join(' ');
    logger.info(message);
    // No console output
  };

  console.debug = (...args) => {
    const message = args.join(' ');
    logger.debug(message);
    // No console output
  };

  // Create a silent mode
  console.silent = {
    log: originalLog,
    error: originalError,
    warn: originalWarn,
    info: originalInfo,
    debug: originalDebug,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
      console.debug = originalDebug;
    }
  };
};

export default suppressConsoleOutput;

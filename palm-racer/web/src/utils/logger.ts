/**
 * @file logger.ts
 * @description Centralized logging utility for PalmRacer.
 *
 * In development mode (import.meta.env.DEV), all log levels output to console.
 * In production mode, only warn and error are emitted; debug/info are silenced.
 *
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.debug('Module', 'message', optionalData);
 *   logger.info('Module', 'message');
 *   logger.warn('Module', 'message', error);
 *   logger.error('Module', 'message', error);
 */

const isDev = import.meta.env.DEV;

function formatPrefix(module: string): string {
  return `[${module}]`;
}

export const logger = {
  /**
   * Debug-level log. Silenced in production.
   */
  debug(module: string, message: string, ...args: unknown[]): void {
    if (isDev) {
      console.log(formatPrefix(module), message, ...args);
    }
  },

  /**
   * Info-level log. Silenced in production.
   */
  info(module: string, message: string, ...args: unknown[]): void {
    if (isDev) {
      console.log(formatPrefix(module), message, ...args);
    }
  },

  /**
   * Warning-level log. Always emitted.
   */
  warn(module: string, message: string, ...args: unknown[]): void {
    console.warn(formatPrefix(module), message, ...args);
  },

  /**
   * Error-level log. Always emitted.
   */
  error(module: string, message: string, ...args: unknown[]): void {
    console.error(formatPrefix(module), message, ...args);
  },
};

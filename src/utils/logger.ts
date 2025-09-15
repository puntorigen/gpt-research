/**
 * Simple logging utility with color support using ANSI codes
 */

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

export class ConsoleOutput {
  static info(message: string): void {
    console.log(`${colors.blue}ℹ${colors.reset}`, message);
  }
  
  static success(message: string): void {
    console.log(`${colors.green}✔${colors.reset}`, message);
  }
  
  static warning(message: string): void {
    console.log(`${colors.yellow}⚠${colors.reset}`, message);
  }
  
  static error(message: string | Error): void {
    const msg = typeof message === 'string' ? message : message.message;
    console.error(`${colors.red}✖${colors.reset}`, msg);
  }
  
  static debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(`${colors.gray}[DEBUG]${colors.reset}`, message);
    }
  }
  
  static log(message: string): void {
    console.log(message);
  }
}

// Default logger instance
export const logger = {
  info: ConsoleOutput.info,
  success: ConsoleOutput.success,
  warning: ConsoleOutput.warning,
  error: ConsoleOutput.error,
  debug: ConsoleOutput.debug,
  log: ConsoleOutput.log
};
import * as dotenv from 'dotenv';

export class Config {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor() {}

  init() {
    dotenv.config();
  }

  get TELEGRAM_TOKEN() {
    const token = process.env.TELEGRAM_TOKEN;
    if (!token) throw new Error('No bot token');
    return token;
  }
}

export const configs = new Config();

#! /usr/bin/env node

'use strict'

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../config/.env');
console.log('Attempting to load .env file from:', envPath);

try {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    throw result.error;
  }
  console.log('Environment variables loaded successfully');
  console.log('BOT_NAME:', process.env.BOT_NAME);
  console.log('ROOM_WHITELIST:', process.env.ROOM_WHITELIST);
  console.log('ALIAS_WHITELIST:', process.env.ALIAS_WHITELIST);
} catch (error) {
  console.error('Error loading .env file:', error);
}

import('./src/index.js').catch(err => {
  console.error('Error importing index.js:', err);
});
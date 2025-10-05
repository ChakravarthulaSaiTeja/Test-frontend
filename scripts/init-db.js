#!/usr/bin/env node
// Database initialization script for Neon

import { initializeDatabase } from '../src/lib/database.ts';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

async function main() {
  try {
    console.log('Initializing Neon database...');
    await initializeDatabase();
    console.log('✅ Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

main();

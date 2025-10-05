#!/usr/bin/env node
// Test Neon database connection

import { neon } from '@netlify/neon';

async function testConnection() {
  try {
    const databaseUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      console.error('❌ No database URL found. Please set NETLIFY_DATABASE_URL environment variable.');
      console.log('Expected format: postgresql://username:password@hostname:port/database_name');
      process.exit(1);
    }

    console.log('🔗 Testing database connection...');
    console.log('📍 Host:', databaseUrl.split('@')[1]?.split('/')[0] || 'Unknown');
    
    const sql = neon(databaseUrl);
    
    // Test basic query
    const result = await sql`SELECT version() as version`;
    console.log('✅ Database connection successful!');
    console.log('📊 PostgreSQL version:', result[0]?.version);
    
    // Test if tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    console.log('📋 Existing tables:', tables.map(t => t.table_name));
    
    if (tables.length === 0) {
      console.log('⚠️  No tables found. Run "npm run init-db" to create tables.');
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your NETLIFY_DATABASE_URL is correct');
    console.log('2. Verify your Neon database is active');
    console.log('3. Check if your IP is whitelisted (if required)');
    process.exit(1);
  }
}

testConnection();

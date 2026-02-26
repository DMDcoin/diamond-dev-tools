#!/usr/bin/env ts-node

/**
 * API Key Management CLI
 * 
 * Commands:
 *   generate - Generate a new API key
 *   list - List all API keys
 *   enable - Enable an API key
 *   disable - Disable an API key
 *   delete - Delete an API key
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import db from '../models';
import { api_keys } from '../models/api_keys';

const SALT_ROUNDS = 12;

interface GenerateKeyOptions {
  label: string;
  type: 'internal' | 'external';
  origins?: string[];
  rateLimitPerMinute?: number;
  rateLimitPerDay?: number;
}

/**
 * Generate a new API key
 */
async function generateKey(options: GenerateKeyOptions): Promise<void> {
  try {
    await db.sequelize.authenticate();
    
    // Generate a secure random key (64 character hex string)
    const apiKey = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
    
    // Hash the key
    const keyHash = await bcrypt.hash(apiKey, SALT_ROUNDS);
    
    // Prepare allowed origins
    let allowedOrigins: string | undefined;
    if (options.type === 'internal' && options.origins && options.origins.length > 0) {
      allowedOrigins = JSON.stringify(options.origins);
    }
    
    // Set default rate limits based on key type
    const rateLimitPerMinute = options.rateLimitPerMinute || (options.type === 'internal' ? 999999 : 60);
    const rateLimitPerDay = options.rateLimitPerDay || (options.type === 'internal' ? 999999 : 10000);
    
    // Create the key record
    const keyRecord = await api_keys.create({
      key_hash: keyHash,
      label: options.label,
      key_type: options.type,
      allowed_origins: allowedOrigins,
      rate_limit_per_minute: rateLimitPerMinute,
      rate_limit_per_day: rateLimitPerDay,
      enabled: true
    });
    
    console.log('\n✅ API Key Generated Successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`ID:                  ${keyRecord.id}`);
    console.log(`Label:               ${keyRecord.label}`);
    console.log(`Type:                ${keyRecord.key_type}`);
    console.log(`Rate Limit/Minute:   ${keyRecord.rate_limit_per_minute}`);
    console.log(`Rate Limit/Day:      ${keyRecord.rate_limit_per_day}`);
    if (allowedOrigins) {
      console.log(`Allowed Origins:     ${allowedOrigins}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🔑 API KEY (store this securely - it won\'t be shown again):');
    console.log(`\n${apiKey}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Error generating API key:', error);
    throw error;
  }
}

/**
 * List all API keys
 */
async function listKeys(): Promise<void> {
  try {
    await db.sequelize.authenticate();
    
    const keys = await api_keys.findAll({
      order: [['created_at', 'DESC']]
    });
    
    if (keys.length === 0) {
      console.log('\nNo API keys found.\n');
      return;
    }
    
    console.log('\n📋 API Keys:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    for (const key of keys) {
      const status = key.enabled ? '✅ Enabled' : '❌ Disabled';
      const lastUsed = key.last_used_at 
        ? new Date(key.last_used_at).toLocaleString()
        : 'Never';
      
      console.log(`ID: ${key.id} | ${status}`);
      console.log(`  Label:        ${key.label}`);
      console.log(`  Type:         ${key.key_type}`);
      console.log(`  Limits:       ${key.rate_limit_per_minute}/min, ${key.rate_limit_per_day}/day`);
      console.log(`  Created:      ${new Date(key.created_at!).toLocaleString()}`);
      console.log(`  Last Used:    ${lastUsed}`);
      if (key.allowed_origins) {
        console.log(`  Origins:      ${key.allowed_origins}`);
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    console.log();
    
  } catch (error) {
    console.error('❌ Error listing API keys:', error);
    throw error;
  }
}

/**
 * Enable an API key
 */
async function enableKey(keyId: number): Promise<void> {
  try {
    await db.sequelize.authenticate();
    
    const result = await api_keys.update(
      { enabled: true },
      { where: { id: keyId } }
    );
    
    if (result[0] === 0) {
      console.log(`\n❌ API key with ID ${keyId} not found.\n`);
      return;
    }
    
    console.log(`\n✅ API key ${keyId} enabled successfully.\n`);
    
  } catch (error) {
    console.error('❌ Error enabling API key:', error);
    throw error;
  }
}

/**
 * Disable an API key
 */
async function disableKey(keyId: number): Promise<void> {
  try {
    await db.sequelize.authenticate();
    
    const result = await api_keys.update(
      { enabled: false },
      { where: { id: keyId } }
    );
    
    if (result[0] === 0) {
      console.log(`\n❌ API key with ID ${keyId} not found.\n`);
      return;
    }
    
    console.log(`\n✅ API key ${keyId} disabled successfully.\n`);
    
  } catch (error) {
    console.error('❌ Error disabling API key:', error);
    throw error;
  }
}

/**
 * Delete an API key
 */
async function deleteKey(keyId: number): Promise<void> {
  try {
    await db.sequelize.authenticate();
    
    const result = await api_keys.destroy({
      where: { id: keyId }
    });
    
    if (result === 0) {
      console.log(`\n❌ API key with ID ${keyId} not found.\n`);
      return;
    }
    
    console.log(`\n✅ API key ${keyId} deleted successfully.\n`);
    
  } catch (error) {
    console.error('❌ Error deleting API key:', error);
    throw error;
  }
}

/**
 * Main CLI handler
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'generate': {
        const label = args[1];
        const type = args[2] as 'internal' | 'external';
        
        if (!label || !type) {
          console.log('\nUsage: npm run keygen generate <label> <internal|external> [options]\n');
          console.log('Options:');
          console.log('  --origins <origin1,origin2>  Comma-separated list of allowed origins (for internal keys)');
          console.log('  --rate-minute <number>       Requests per minute limit (default: internal=999999, external=60)');
          console.log('  --rate-day <number>          Requests per day limit (default: internal=999999, external=10000)');
          console.log('\nExamples:');
          console.log('  npm run keygen generate "My UI Key" internal --origins https://example.com,https://www.example.com');
          console.log('  npm run keygen generate "Partner API" external --rate-minute 100 --rate-day 50000\n');
          process.exit(1);
        }
        
        if (type !== 'internal' && type !== 'external') {
          console.error('\n❌ Type must be either "internal" or "external"\n');
          process.exit(1);
        }
        
        const options: GenerateKeyOptions = { label, type };
        
        // Parse optional arguments
        for (let i = 3; i < args.length; i++) {
          if (args[i] === '--origins' && args[i + 1]) {
            options.origins = args[i + 1].split(',').map(o => o.trim());
            i++;
          } else if (args[i] === '--rate-minute' && args[i + 1]) {
            options.rateLimitPerMinute = parseInt(args[i + 1], 10);
            i++;
          } else if (args[i] === '--rate-day' && args[i + 1]) {
            options.rateLimitPerDay = parseInt(args[i + 1], 10);
            i++;
          }
        }
        
        await generateKey(options);
        break;
      }
      
      case 'list':
        await listKeys();
        break;
      
      case 'enable': {
        const keyId = parseInt(args[1], 10);
        if (isNaN(keyId)) {
          console.error('\n❌ Please provide a valid key ID\n');
          console.log('Usage: npm run keygen enable <key_id>\n');
          process.exit(1);
        }
        await enableKey(keyId);
        break;
      }
      
      case 'disable': {
        const keyId = parseInt(args[1], 10);
        if (isNaN(keyId)) {
          console.error('\n❌ Please provide a valid key ID\n');
          console.log('Usage: npm run keygen disable <key_id>\n');
          process.exit(1);
        }
        await disableKey(keyId);
        break;
      }
      
      case 'delete': {
        const keyId = parseInt(args[1], 10);
        if (isNaN(keyId)) {
          console.error('\n❌ Please provide a valid key ID\n');
          console.log('Usage: npm run keygen delete <key_id>\n');
          process.exit(1);
        }
        await deleteKey(keyId);
        break;
      }
      
      default:
        console.log('\n🔑 API Key Management CLI\n');
        console.log('Commands:');
        console.log('  generate <label> <internal|external> [options]  Generate a new API key');
        console.log('  list                                             List all API keys');
        console.log('  enable <key_id>                                  Enable an API key');
        console.log('  disable <key_id>                                 Disable an API key');
        console.log('  delete <key_id>                                  Delete an API key');
        console.log('\nExamples:');
        console.log('  npm run keygen generate "My UI Key" internal --origins https://example.com');
        console.log('  npm run keygen generate "Partner API" external --rate-minute 100');
        console.log('  npm run keygen list');
        console.log('  npm run keygen enable 1');
        console.log('  npm run keygen disable 2');
        console.log('  npm run keygen delete 3\n');
    }
    
    await db.sequelize.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    await db.sequelize.close();
    process.exit(1);
  }
}

// Run the CLI
main();

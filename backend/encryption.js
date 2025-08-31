/**
 * encryption.js - Encryption module for IP Messenger Clone
 * 
 * This module provides AES encryption and decryption functions for securing
 * messages and file transfers between peers on the local network.
 */

const crypto = require('crypto');

// Encryption settings
// Note: In a production environment, these should be stored securely and not hardcoded
const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'; // 32 bytes for AES-256
const ENCRYPTION_IV_LENGTH = 16; // 16 bytes for AES
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt a string message using AES encryption
 * @param {string} message - The plaintext message to encrypt
 * @returns {string} - Base64 encoded encrypted message
 */
function encryptMessage(message) {
  try {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
    
    // Create cipher with key and iv
    const cipher = crypto.createCipheriv(
      ENCRYPTION_ALGORITHM,
      Buffer.from(ENCRYPTION_KEY),
      iv
    );
    
    // Encrypt the message
    let encrypted = cipher.update(message, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Prepend the IV to the encrypted message (IV is needed for decryption)
    // Format: iv:encrypted
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt message');
  }
}

/**
 * Decrypt an encrypted message
 * @param {string} encryptedMessage - The encrypted message (format: iv:encrypted)
 * @returns {string} - Decrypted plaintext message
 */
function decryptMessage(encryptedMessage) {
  try {
    // Split the IV and encrypted parts
    const parts = encryptedMessage.split(':');
    
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted message format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    // Create decipher with key and iv
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      Buffer.from(ENCRYPTION_KEY),
      iv
    );
    
    // Decrypt the message
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt message');
  }
}

/**
 * Encrypt a buffer (for file transfers)
 * @param {Buffer} buffer - The buffer to encrypt
 * @returns {Buffer} - Encrypted buffer with IV prepended
 */
function encryptBuffer(buffer) {
  try {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
    
    // Create cipher with key and iv
    const cipher = crypto.createCipheriv(
      ENCRYPTION_ALGORITHM,
      Buffer.from(ENCRYPTION_KEY),
      iv
    );
    
    // Encrypt the buffer
    const encryptedBuffer = Buffer.concat([
      cipher.update(buffer),
      cipher.final()
    ]);
    
    // Prepend the IV to the encrypted buffer
    return Buffer.concat([iv, encryptedBuffer]);
  } catch (error) {
    console.error('Buffer encryption error:', error);
    throw new Error('Failed to encrypt buffer');
  }
}

/**
 * Decrypt an encrypted buffer
 * @param {Buffer} encryptedBuffer - The encrypted buffer with IV prepended
 * @returns {Buffer} - Decrypted buffer
 */
function decryptBuffer(encryptedBuffer) {
  try {
    // Extract the IV from the beginning of the buffer
    const iv = encryptedBuffer.slice(0, ENCRYPTION_IV_LENGTH);
    const encrypted = encryptedBuffer.slice(ENCRYPTION_IV_LENGTH);
    
    // Create decipher with key and iv
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      Buffer.from(ENCRYPTION_KEY),
      iv
    );
    
    // Decrypt the buffer
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
  } catch (error) {
    console.error('Buffer decryption error:', error);
    throw new Error('Failed to decrypt buffer');
  }
}

/**
 * Generate a random encryption key
 * @param {number} length - Length of the key in bytes
 * @returns {string} - Hex encoded random key
 */
function generateEncryptionKey(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a string using SHA-256
 * @param {string} data - The string to hash
 * @returns {string} - Hex encoded hash
 */
function hashString(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = {
  encryptMessage,
  decryptMessage,
  encryptBuffer,
  decryptBuffer,
  generateEncryptionKey,
  hashString
};
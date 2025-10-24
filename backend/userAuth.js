/**
 * userAuth.js - User authentication and storage
 * 
 * This module handles user authentication, registration, and storage
 * for the LAN Connect application.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Path to the users database file
const USERS_FILE = path.join(__dirname, 'users.json');

// Initialize users database if it doesn't exist
function initUsersDb() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }), 'utf8');
    console.log('Created users database file');
  }
}

// Load users from the database file
function loadUsers() {
  try {
    initUsersDb();
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data).users;
  } catch (error) {
    console.error('Error loading users:', error);
    return [];
  }
}

// Save users to the database file
function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving users:', error);
    return false;
  }
}

// Hash a password
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

// Verify a password against a stored hash
function verifyPassword(password, storedHash, storedSalt) {
  const hash = crypto.pbkdf2Sync(password, storedSalt, 1000, 64, 'sha512').toString('hex');
  return hash === storedHash;
}

// Generate a JWT-like token (simplified for demo)
function generateToken(userId) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64');
  const signature = crypto.createHmac('sha256', 'secret_key')
    .update(`${header}.${payload}`)
    .digest('base64');
  
  return `${header}.${payload}.${signature}`;
}

// Register a new user
function registerUser(username, password) {
  const users = loadUsers();
  
  // Check if username already exists
  if (users.some(user => user.username === username)) {
    return { success: false, message: 'Username already exists' };
  }
  
  // Hash the password
  const { salt, hash } = hashPassword(password);
  
  // Create new user
  const newUser = {
    id: Date.now().toString(),
    username,
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString()
  };
  
  // Add to users array and save
  users.push(newUser);
  if (!saveUsers(users)) {
    return { success: false, message: 'Error saving user data' };
  }
  
  // Return user without sensitive data
  const { passwordHash, passwordSalt, ...userWithoutPassword } = newUser;
  return { 
    success: true, 
    user: userWithoutPassword,
    token: generateToken(newUser.id)
  };
}

// Login a user
function loginUser(username, password) {
  const users = loadUsers();
  
  // Find user by username
  const user = users.find(user => user.username === username);
  if (!user) {
    return { success: false, message: 'Invalid username or password' };
  }
  
  // Verify password
  if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    return { success: false, message: 'Invalid username or password' };
  }
  
  // Return user without sensitive data
  const { passwordHash, passwordSalt, ...userWithoutPassword } = user;
  return { 
    success: true, 
    user: userWithoutPassword,
    token: generateToken(user.id)
  };
}

// Get user by ID
function getUserById(userId) {
  const users = loadUsers();
  const user = users.find(user => user.id === userId);
  
  if (!user) return null;
  
  // Return user without sensitive data
  const { passwordHash, passwordSalt, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// Update user information
function updateUser(userId, updates) {
  const users = loadUsers();
  const userIndex = users.findIndex(user => user.id === userId);
  
  if (userIndex === -1) {
    return { success: false, message: 'User not found' };
  }
  
  // Update user fields
  const updatedUser = { ...users[userIndex], ...updates };
  users[userIndex] = updatedUser;
  
  if (!saveUsers(users)) {
    return { success: false, message: 'Error saving user data' };
  }
  
  // Return user without sensitive data
  const { passwordHash, passwordSalt, ...userWithoutPassword } = updatedUser;
  return { success: true, user: userWithoutPassword };
}

// Initialize the users database on module load
initUsersDb();

// Get user settings
function getUserSettings() {
  try {
    const settingsPath = path.join(__dirname, 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      // Create default settings if file doesn't exist
      const defaultSettings = {
        accessCode: 'offgrid2023',
        theme: 'light'
      };
      fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf8');
      return defaultSettings;
    }
    
    const settingsData = fs.readFileSync(settingsPath, 'utf8');
    return JSON.parse(settingsData);
  } catch (error) {
    console.error('Error loading settings:', error);
    // Return default settings in case of error
    return {
      accessCode: 'offgrid2023',
      theme: 'light'
    };
  }
}

// Update user settings
function updateUserSettings(settings) {
  try {
    const settingsPath = path.join(__dirname, 'settings.json');
    const currentSettings = getUserSettings();
    const updatedSettings = { ...currentSettings, ...settings };
    
    fs.writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2), 'utf8');
    return { success: true, settings: updatedSettings };
  } catch (error) {
    console.error('Error updating settings:', error);
    return { success: false, message: 'Failed to update settings' };
  }
}

module.exports = {
  registerUser,
  loginUser,
  getUserById,
  updateUser,
  getUserSettings,
  updateUserSettings
};
/**
 * authService.js - Authentication service
 * 
 * This service handles user authentication operations including
 * login, registration, and session management.
 */

// Function to register a new user
export const registerUser = async (username, password) => {
  try {
    const response = await fetch('http://localhost:8080/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }
    
    return data;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

// Function to login a user
export const loginUser = async (username, password) => {
  try {
    const response = await fetch('http://localhost:8080/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }
    
    // Store user data in localStorage for persistence
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('token', data.token);
    
    return data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

// Function to logout the current user
export const logoutUser = () => {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
};

// Function to check if a user is logged in
export const isLoggedIn = () => {
  return localStorage.getItem('token') !== null;
};

// Function to get the current user
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
};

// Function to get the authentication token
export const getToken = () => {
  return localStorage.getItem('token');
};

// For development/demo purposes - simulate authentication without backend
export const simulateAuth = (username, password) => {
  // Simple validation
  if (!username || !password) {
    throw new Error('Username and password are required');
  }
  
  // Create a mock user object
  const user = {
    id: Date.now().toString(),
    username,
    createdAt: new Date().toISOString()
  };
  
  // Create a mock token
  const token = `mock-token-${Math.random().toString(36).substring(2, 15)}`;
  
  // Store in localStorage
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', token);
  
  return { user, token };
};

// For development/demo purposes - simulate registration without backend
export const simulateRegistration = (username, password) => {
  // Simple validation
  if (!username || !password) {
    throw new Error('Username and password are required');
  }
  
  // Check if username already exists in localStorage
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  if (users.some(u => u.username === username)) {
    throw new Error('Username already exists');
  }
  
  // Create a new user
  const newUser = {
    id: Date.now().toString(),
    username,
    password, // In a real app, never store plain passwords
    createdAt: new Date().toISOString()
  };
  
  // Add to users array
  users.push(newUser);
  localStorage.setItem('users', JSON.stringify(users));
  
  // Return user without password
  const { password: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
};
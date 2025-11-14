/**
 * websocketService.js - WebSocket service for communication with the backend
 * 
 * This service manages the WebSocket connection to the backend server,
 * handling connection, message sending, and reconnection logic.
 * 
 * Features:
 * - Automatic connection to WebSocket server
 * - Automatic reconnection with exponential backoff
 * - Message sending and receiving
 * - Event handling for connection state changes
 * - Error handling and recovery
 */

/**
 * WebSocket connection instance
 * Null when disconnected, WebSocket object when connected
 * @type {WebSocket|null}
 */
let ws = null;

/**
 * Connected peers WebSocket connections
 * Maps peer ID to WebSocket connection
 * @type {Map<string, WebSocket>}
 */
let peerConnections = new Map();

/**
 * Connection configuration constants
 */
const WS_PORT = 8080; // WebSocket server port
const RECONNECT_INTERVAL = 3000; // Initial reconnect delay (3 seconds)
const MAX_RECONNECT_ATTEMPTS = 20; // Maximum number of reconnection attempts

/**
 * Encryption configuration (must match backend)
 * Backend uses AES-256-CBC with a 32-byte ASCII key and iv prepended
 * Format over the wire: `${ivHex}:${base64Cipher}`
 */
const ENCRYPTION_KEY_STRING = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
let cryptoKey = null; // Cached CryptoKey

// Utility: import key as raw bytes (ASCII) for AES-CBC
async function getCryptoKey() {
  if (cryptoKey) return cryptoKey;
  const keyBytes = new TextEncoder().encode(ENCRYPTION_KEY_STRING);
  cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-CBC' },
    false,
    ['encrypt', 'decrypt']
  );
  return cryptoKey;
}

// Utility: ArrayBuffer -> base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Utility: base64 -> Uint8Array
function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Encrypt plaintext string to `${ivHex}:${base64Cipher}`
async function encryptString(plaintext) {
  const key = await getCryptoKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(16));
  const data = new TextEncoder().encode(plaintext);
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    key,
    data
  );
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const cipherB64 = arrayBufferToBase64(cipherBuffer);
  return `${ivHex}:${cipherB64}`;
}

// Decrypt `${ivHex}:${base64Cipher}` to plaintext string
async function decryptString(encrypted) {
  // If message is already JSON, return as-is
  if (typeof encrypted !== 'string' || !encrypted.includes(':')) {
    return encrypted;
  }
  const [ivHex, cipherB64] = encrypted.split(':');
  if (!ivHex || !cipherB64 || ivHex.length !== 32) {
    // Not our encrypted format; return raw
    return encrypted;
  }
  const key = await getCryptoKey();
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(h => parseInt(h, 16)));
  const cipherBytes = base64ToUint8Array(cipherB64);
  try {
    const plainBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-CBC', iv },
      key,
      cipherBytes
    );
    return new TextDecoder().decode(plainBuffer);
  } catch (e) {
    console.error('Decryption failed; delivering raw message:', e);
    return encrypted; // Fallback to raw if decryption fails
  }
}

/**
 * Callback handler functions for WebSocket events
 * These are set by the application when initializing the service
 * @type {Object}
 */
let handlers = {
  onOpen: () => {}, // Called when connection is established
  onClose: () => {}, // Called when connection is closed
  onError: () => {}, // Called when an error occurs
  onMessage: () => {} // Called when a message is received
};

/**
 * Reconnection state tracking
 */
let reconnectAttempts = 0; // Current number of reconnection attempts
let reconnectTimer = null; // Timer for scheduled reconnection attempts

/**
 * Initialize the WebSocket connection to the backend server
 * 
 * This function sets up the WebSocket connection and registers event handlers.
 * It will close any existing connection before creating a new one.
 * If the connection fails to establish, it will schedule a reconnection attempt.
 * 
 * @param {Object} callbacks - Callback functions for WebSocket events
 * @param {Function} [callbacks.onOpen] - Called when connection is established
 * @param {Function} [callbacks.onClose] - Called when connection is closed
 * @param {Function} [callbacks.onError] - Called when an error occurs
 * @param {Function} [callbacks.onMessage] - Called when a message is received
 */
function initializeWebSocket(callbacks) {
  // Register callback handlers, preserving any existing handlers not specified
  if (callbacks) {
    handlers = { ...handlers, ...callbacks };
  }
  
  // Close existing connection if one exists to prevent duplicate connections
  if (ws) {
    closeWebSocket();
  }
  
  // Determine the WebSocket server host
  // Uses the same host as the web application for local development
  const host = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
  
  // Attempt to create a new WebSocket connection
  try {
    // Create the WebSocket instance
    ws = new WebSocket(`ws://${host}:${WS_PORT}`);
    
    // Register internal event handlers that will call the application callbacks
    ws.onopen = handleOpen;
    ws.onclose = handleClose;
    ws.onerror = handleError;
    ws.onmessage = handleMessage;
    
    console.log(`Connecting to WebSocket server at ws://${host}:${WS_PORT}`);
  } catch (error) {
    // Handle any errors during WebSocket creation
    console.error('Error creating WebSocket connection:', error);
    handlers.onError(error);
    scheduleReconnect(); // Attempt to reconnect after failure
  }
}

/**
 * Handle WebSocket open event when connection is successfully established
 * 
 * This function is called when the WebSocket connection is successfully opened.
 * It resets the reconnection attempt counter and notifies the application.
 */
function handleOpen() {
  console.log('WebSocket connection established');
  reconnectAttempts = 0; // Reset reconnection attempts counter on successful connection
  handlers.onOpen(); // Notify the application that connection is established
}

/**
 * Handle WebSocket close event when connection is terminated
 * 
 * This function is called when the WebSocket connection is closed.
 * It logs the close reason, notifies the application, and attempts to reconnect
 * if the connection wasn't closed intentionally (code 1000 = normal closure).
 * 
 * @param {CloseEvent} event - WebSocket close event with code and reason
 * @param {number} event.code - Close status code (1000 = normal closure)
 * @param {string} event.reason - Close reason description
 */
function handleClose(event) {
  console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
  handlers.onClose(event); // Notify the application that connection is closed
  
  // Attempt to reconnect if not closed intentionally by the application
  if (event.code !== 1000) { // 1000 = normal closure (intentional)
    scheduleReconnect(); // Schedule automatic reconnection
  }
}

/**
 * Handle WebSocket error event when connection encounters a problem
 * 
 * This function is called when the WebSocket connection encounters an error.
 * It logs the error and notifies the application.
 * Note: The WebSocket will automatically close after an error, triggering handleClose().
 * 
 * @param {Event} event - WebSocket error event
 */
function handleError(event) {
  console.error('WebSocket error:', event);
  handlers.onError(event); // Notify the application of the error
  // No need to call scheduleReconnect() here as handleClose() will be called automatically
}

/**
 * Handle WebSocket message event when data is received from the server
 * 
 * This function is called when a message is received from the WebSocket server.
 * It parses the message data (if JSON) and notifies the application.
 * 
 * @param {MessageEvent} event - WebSocket message event
 * @param {string|ArrayBuffer|Blob|ArrayBufferView} event.data - The message data
 */
async function handleMessage(event) {
  try {
    const decrypted = await decryptString(event.data);
    handlers.onMessage(decrypted);
  } catch (error) {
    console.error('Error handling message:', error);
  }
}

/**
 * Send a message through the WebSocket connection
 * 
 * This function serializes the message object to JSON and sends it through
 * the WebSocket connection. It checks if the connection is open before sending.
 * 
 * @param {Object} message - Message object to send to the server
 * @returns {boolean} - True if message was sent successfully, false otherwise
 */
async function sendMessage(message) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error('Cannot send message: WebSocket is not connected');
    return false;
  }
  try {
    const plaintext = JSON.stringify(message);
    const encrypted = await encryptString(plaintext);
    ws.send(encrypted);
    return true;
  } catch (error) {
    console.error('Error sending message:', error);
    return false;
  }
}

/**
 * Close the WebSocket connection cleanly
 * 
 * This function performs a graceful shutdown of the WebSocket connection:
 * 1. Removes event handlers to prevent automatic reconnection
 * 2. Closes the connection with a normal closure code
 * 3. Clears the WebSocket reference
 * 4. Cancels any pending reconnection attempts
 * 
 * Code 1000 indicates a normal closure, meaning the connection was closed normally
 */
function closeWebSocket() {
  if (ws) {
    // Remove event handlers to prevent reconnection when we intentionally close
    ws.onclose = null; // Prevent handleClose from being called
    ws.onerror = null; // Prevent handleError from being called
    
    // Only attempt to close if the connection is open or in the process of connecting
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close(1000, 'Closed by client'); // 1000 = normal closure
    }
    
    ws = null; // Clear the WebSocket reference
  }
  
  // Cancel any scheduled reconnection attempt
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null; // Clear the timer reference
  }
}

/**
 * Schedule a reconnection attempt with exponential backoff
 * 
 * This function implements a smart reconnection strategy:
 * 1. Uses exponential backoff to gradually increase wait time between attempts
 * 2. Caps the maximum wait time at 30 seconds to prevent excessive delays
 * 3. Resets and retries after reaching maximum attempts
 * 4. Tracks reconnection attempts to prevent infinite reconnection loops
 */
function scheduleReconnect() {
  // Clear any existing reconnect timer to prevent multiple timers
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  
  // Check if maximum reconnection attempts have been reached
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`Maximum reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
    // After reaching max attempts, wait longer and reset the counter to try again
    // This prevents the application from giving up permanently
    setTimeout(() => {
      reconnectAttempts = 0;
      scheduleReconnect();
    }, RECONNECT_INTERVAL * 2);
    return;
  }
  
  // Increment reconnect attempts counter
  reconnectAttempts++;
  
  // Calculate backoff time using exponential formula: initialInterval * 1.5^(attempts-1)
  // Cap the maximum wait time at 30 seconds to prevent excessive delays
  const backoffTime = Math.min(RECONNECT_INTERVAL * Math.pow(1.5, reconnectAttempts - 1), 30000);
  
  // Log reconnection schedule and set timer
  console.log(`Scheduling reconnect attempt ${reconnectAttempts} in ${backoffTime}ms`);
  reconnectTimer = setTimeout(() => {
    console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    initializeWebSocket(); // Try to establish connection again
  }, backoffTime);
}

/**
 * Check if the WebSocket is currently connected
 * 
 * This utility function checks if the WebSocket connection is established and ready for communication.
 * It verifies both that the WebSocket object exists and that its state is OPEN (ready for data transfer).
 * 
 * WebSocket states:
 * - CONNECTING (0): Connection is being established
 * - OPEN (1): Connection is established and ready for data transfer
 * - CLOSING (2): Connection is being closed
 * - CLOSED (3): Connection is closed or couldn't be opened
 * 
 * @returns {boolean} - True if WebSocket exists and is in OPEN state, false otherwise
 */
function isConnected() {
  return ws && ws.readyState === WebSocket.OPEN;
}

/**
 * Connect to a discovered peer
 * 
 * @param {Object} peer - Peer information
 * @param {string} peer.id - Peer ID
 * @param {string} peer.ip - Peer IP address
 * @param {number} peer.port - Peer WebSocket port
 * @returns {Promise<boolean>} - True if connection successful, false otherwise
 */
function connectToPeer(peer) {
  return new Promise((resolve) => {
    try {
      // Check if already connected to this peer
      if (peerConnections.has(peer.id)) {
        const existingConnection = peerConnections.get(peer.id);
        if (existingConnection.readyState === WebSocket.OPEN) {
          console.log(`Already connected to peer ${peer.id}`);
          resolve(true);
          return;
        } else {
          // Remove stale connection
          peerConnections.delete(peer.id);
        }
      }
      
      // Create WebSocket connection to peer
      const peerWs = new WebSocket(`ws://${peer.ip}:${peer.port}`);
      
      peerWs.onopen = () => {
        console.log(`Connected to peer ${peer.id}`);
        peerConnections.set(peer.id, peerWs);
        resolve(true);
      };
      
      peerWs.onclose = (event) => {
        console.log(`Connection to peer ${peer.id} closed: ${event.code} ${event.reason}`);
        peerConnections.delete(peer.id);
        resolve(false);
      };
      
      peerWs.onerror = (error) => {
        console.error(`Error connecting to peer ${peer.id}:`, error);
        peerConnections.delete(peer.id);
        resolve(false);
      };
      
      peerWs.onmessage = async (event) => {
        // Decrypt and forward peer messages to the main handler
        if (handlers.onMessage) {
          try {
            const decrypted = await decryptString(event.data);
            handlers.onMessage(decrypted);
          } catch (e) {
            handlers.onMessage(event.data);
          }
        }
      };
      
    } catch (error) {
      console.error(`Error creating connection to peer ${peer.id}:`, error);
      resolve(false);
    }
  });
}

/**
 * Disconnect from a peer
 * 
 * @param {string} peerId - Peer ID to disconnect from
 */
function disconnectFromPeer(peerId) {
  const peerWs = peerConnections.get(peerId);
  if (peerWs) {
    peerWs.close(1000, 'Disconnected by user');
    peerConnections.delete(peerId);
    console.log(`Disconnected from peer ${peerId}`);
  }
}

/**
 * Send message to a specific peer
 * 
 * @param {string} peerId - Peer ID to send message to
 * @param {Object} message - Message object to send
 * @returns {boolean} - True if message was sent successfully, false otherwise
 */
async function sendMessageToPeer(peerId, message) {
  const peerWs = peerConnections.get(peerId);
  
  if (!peerWs || peerWs.readyState !== WebSocket.OPEN) {
    console.error(`Cannot send message to peer ${peerId}: Connection not open`);
    return false;
  }
  
  try {
    const plaintext = JSON.stringify(message);
    const encrypted = await encryptString(plaintext);
    peerWs.send(encrypted);
    return true;
  } catch (error) {
    console.error(`Error sending message to peer ${peerId}:`, error);
    return false;
  }
}

/**
 * Get connected peers
 * 
 * @returns {Array} Array of connected peer IDs
 */
function getConnectedPeers() {
  return Array.from(peerConnections.keys());
}

/**
 * Check if connected to a specific peer
 * 
 * @param {string} peerId - Peer ID to check
 * @returns {boolean} - True if connected to the peer
 */
function isConnectedToPeer(peerId) {
  const peerWs = peerConnections.get(peerId);
  return peerWs && peerWs.readyState === WebSocket.OPEN;
}

/**
 * Close all peer connections
 */
function closeAllPeerConnections() {
  peerConnections.forEach((peerWs, peerId) => {
    peerWs.close(1000, 'Application closing');
  });
  peerConnections.clear();
}

/**
 * Export the WebSocket service API
 * 
 * These functions provide the public interface for the WebSocket service:
 * - initializeWebSocket: Establish connection with callback handlers
 * - sendMessage: Send data to the server
 * - closeWebSocket: Terminate the connection cleanly
 * - isConnected: Check connection status
 * - connectToPeer: Connect to a discovered peer
 * - disconnectFromPeer: Disconnect from a peer
 * - sendMessageToPeer: Send message to a specific peer
 * - getConnectedPeers: Get list of connected peers
 * - isConnectedToPeer: Check if connected to a specific peer
 * - closeAllPeerConnections: Close all peer connections
 */
export {
  initializeWebSocket,
  sendMessage,
  closeWebSocket,
  isConnected,
  connectToPeer,
  disconnectFromPeer,
  sendMessageToPeer,
  getConnectedPeers,
  isConnectedToPeer,
  closeAllPeerConnections
};
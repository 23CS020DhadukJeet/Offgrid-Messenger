/**
 * peers.js - Peer management module for IP Messenger Clone
 * 
 * This module handles the management of peer connections, including adding,
 * removing, and communicating with peers on the local network.
 */

const WebSocket = require('ws');
const { encryptMessage } = require('./encryption');

// Store connected peers
let peers = [];

// Store discovered peers (including unauthorized ones)
let discoveredPeers = [];

/**
 * Add a new peer to the peer list
 * @param {string} id - Unique identifier for the peer (usually IP:PORT)
 * @param {WebSocket} socket - WebSocket connection to the peer
 * @param {string} ip - IP address of the peer
 * @param {string} hostname - Hostname of the peer (optional)
 * @param {boolean} authorized - Whether the peer is authorized (has correct access code)
 */
function addPeer(id, socket, ip, hostname = null) {
  // Check if peer already exists
  const existingPeerIndex = peers.findIndex(peer => peer.id === id);
  
  if (existingPeerIndex !== -1) {
    // Update existing peer
    peers[existingPeerIndex] = {
      id,
      socket,
      ip,
      hostname,
      connectedAt: Date.now()
    };
    console.log(`Updated existing peer: ${id}`);
  } else {
    // Add new peer
    peers.push({
      id,
      socket,
      ip,
      hostname,
      connectedAt: Date.now()
    });
    console.log(`Added new peer: ${id}`);
  }
}

/**
 * Remove a peer from the peer list
 * @param {string} id - Unique identifier for the peer to remove
 */
function removePeer(id) {
  const initialCount = peers.length;
  peers = peers.filter(peer => peer.id !== id);
  
  if (peers.length < initialCount) {
    console.log(`Removed peer: ${id}`);
  } else {
    console.log(`Attempted to remove peer ${id}, but it was not found`);
  }
}

/**
 * Get the list of all connected peers
 * @returns {Array} - Array of peer objects
 */
function getPeers() {
  return peers;
}

/**
 * Get a specific peer by ID
 * @param {string} id - Unique identifier for the peer
 * @returns {Object|null} - Peer object or null if not found
 */
function getPeerById(id) {
  return peers.find(peer => peer.id === id) || null;
}

/**
 * Broadcast a message to all connected peers except the sender
 * @param {string} message - JSON string message to broadcast
 * @param {string} excludePeerId - ID of peer to exclude from broadcast (usually the sender)
 */
function broadcastToPeers(message, excludePeerId = null) {
  const encryptedMessage = encryptMessage(message);
  
  peers.forEach(peer => {
    // Skip the excluded peer (usually the sender)
    if (excludePeerId && peer.id === excludePeerId) {
      return;
    }
    
    // Only send to peers with open connections
    if (peer.socket.readyState === WebSocket.OPEN) {
      try {
        peer.socket.send(encryptedMessage);
      } catch (error) {
        console.error(`Error sending message to peer ${peer.id}:`, error);
      }
    }
  });
}

/**
 * Send a message to a specific peer
 * @param {string} peerId - ID of the peer to send the message to
 * @param {string} message - JSON string message to send
 * @returns {boolean} - True if message was sent, false otherwise
 */
function sendToPeer(peerId, message) {
  const peer = getPeerById(peerId);
  
  if (!peer || peer.socket.readyState !== WebSocket.OPEN) {
    console.error(`Cannot send message to peer ${peerId}: Peer not found or connection not open`);
    return false;
  }
  
  try {
    const encryptedMessage = encryptMessage(message);
    peer.socket.send(encryptedMessage);
    return true;
  } catch (error) {
    console.error(`Error sending message to peer ${peerId}:`, error);
    return false;
  }
}

/**
 * Connect to a peer using their IP and port
 * @param {string} ip - IP address of the peer
 * @param {number} port - WebSocket port of the peer
 * @returns {Promise} - Resolves with the peer ID if connection is successful
 */
function connectToPeer(ip, port) {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(`ws://${ip}:${port}`);
      
      ws.on('open', () => {
        const peerId = `${ip}:${port}`;
        addPeer(peerId, ws, ip);
        resolve(peerId);
      });
      
      ws.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Check if peers are still alive and remove any that are not responding
 */
function cleanupDeadPeers() {
  const now = Date.now();
  const PEER_TIMEOUT = 30000; // 30 seconds
  
  peers.forEach(peer => {
    // If the socket is not open, check how long it's been closed
    if (peer.socket.readyState !== WebSocket.OPEN) {
      if (!peer.lastActive || (now - peer.lastActive > PEER_TIMEOUT)) {
        console.log(`Removing unresponsive peer: ${peer.id}`);
        removePeer(peer.id);
      }
    } else {
      // Send a ping to check if the peer is still alive
      try {
        peer.socket.ping();
      } catch (error) {
        console.error(`Error pinging peer ${peer.id}:`, error);
        peer.lastActive = now; // Mark the time we detected an issue
      }
    }
  });
}

// Run cleanup every minute
setInterval(cleanupDeadPeers, 60000);

/**
 * Add a peer to the discovery list
 * @param {Object} peer - Peer object with id, ip, port, hostname, lastSeen, and authorized status
 */
function addPeerToDiscoveryList(peer) {
  const existingIndex = discoveredPeers.findIndex(p => p.id === peer.id);
  
  if (existingIndex !== -1) {
    // Update existing peer
    discoveredPeers[existingIndex] = {
      ...discoveredPeers[existingIndex],
      ...peer,
      lastSeen: Date.now()
    };
  } else {
    // Add new peer
    discoveredPeers.push({
      ...peer,
      lastSeen: Date.now()
    });
  }
  
  // Broadcast updated peer list to all connected clients
  broadcastPeerListUpdate();
}

/**
 * Update a peer's last seen timestamp
 * @param {string} peerId - ID of the peer to update
 */
function updatePeerLastSeen(peerId) {
  const peerIndex = discoveredPeers.findIndex(p => p.id === peerId);
  
  if (peerIndex !== -1) {
    discoveredPeers[peerIndex].lastSeen = Date.now();
  }
}

/**
 * Update a peer's authorization status
 * @param {string} peerId - ID of the peer to update
 * @param {boolean} authorized - Whether the peer is authorized
 */
function updatePeerAuthStatus(peerId, authorized) {
  const peerIndex = discoveredPeers.findIndex(p => p.id === peerId);
  
  if (peerIndex !== -1) {
    discoveredPeers[peerIndex].authorized = authorized;
    // Broadcast updated peer list to all connected clients
    broadcastPeerListUpdate();
  }
}

/**
 * Get all discovered peers (including unauthorized ones)
 * @returns {Array} - Array of discovered peer objects
 */
function getDiscoveredPeers() {
  return discoveredPeers;
}

/**
 * Remove inactive peers from the discovery list
 * @param {number} timeout - Time in milliseconds after which a peer is considered inactive
 */
function removeInactivePeers(timeout) {
  const now = Date.now();
  const initialCount = discoveredPeers.length;
  
  discoveredPeers = discoveredPeers.filter(peer => (now - peer.lastSeen) < timeout);
  
  if (discoveredPeers.length < initialCount) {
    console.log(`Removed ${initialCount - discoveredPeers.length} inactive peers`);
    // Broadcast updated peer list to all connected clients
    broadcastPeerListUpdate();
  }
}

/**
 * Broadcast the updated peer list to all connected clients
 */
function broadcastPeerListUpdate() {
  const peerListMessage = {
    type: 'peer_list',
    peers: discoveredPeers.map(peer => ({
      id: peer.id,
      ip: peer.ip,
      hostname: peer.hostname || 'Unknown',
      authorized: peer.authorized,
      capabilities: peer.capabilities || [],
      version: peer.version || '1.0.0'
    }))
  };
  
  broadcastToPeers(JSON.stringify(peerListMessage));
}

module.exports = {
  addPeer,
  removePeer,
  getPeers,
  getPeerById,
  broadcastToPeers,
  sendToPeer,
  connectToPeer,
  addPeerToDiscoveryList,
  updatePeerLastSeen,
  updatePeerAuthStatus,
  getDiscoveredPeers,
  removeInactivePeers
};
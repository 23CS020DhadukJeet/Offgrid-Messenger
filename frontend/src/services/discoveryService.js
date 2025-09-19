/**
 * discoveryService.js - Peer discovery service
 * 
 * This service handles peer discovery through UDP broadcasting and manages
 * connections to discovered peers on the local network.
 */

// Store discovered peers
let discoveredPeers = new Map();
let discoveryCallbacks = [];

/**
 * Initialize peer discovery
 * 
 * This function sets up listeners for peer discovery events from the main process
 * and manages the discovered peers list.
 */
function initializeDiscovery() {
  if (window.electron) {
    // Listen for peer discovery events from main process
    window.electron.on('peer-discovered', (peerInfo) => {
      handlePeerDiscovered(peerInfo);
    });
  }
}

/**
 * Handle a newly discovered peer
 * 
 * @param {Object} peerInfo - Information about the discovered peer
 * @param {string} peerInfo.ip - IP address of the peer
 * @param {number} peerInfo.port - WebSocket port of the peer
 * @param {string} peerInfo.hostname - Hostname of the peer
 * @param {number} peerInfo.discoveredAt - Timestamp when peer was discovered
 */
function handlePeerDiscovered(peerInfo) {
  const peerId = `${peerInfo.ip}:${peerInfo.port}`;
  
  // Check if this is a new peer or an update to an existing one
  const existingPeer = discoveredPeers.get(peerId);
  const isNewPeer = !existingPeer;
  
  // Update the peer information
  const peer = {
    id: peerId,
    ip: peerInfo.ip,
    port: peerInfo.port,
    hostname: peerInfo.hostname,
    discoveredAt: peerInfo.discoveredAt,
    lastSeen: Date.now(),
    status: 'discovered'
  };
  
  discoveredPeers.set(peerId, peer);
  
  // Notify callbacks about the peer discovery
  discoveryCallbacks.forEach(callback => {
    try {
      callback(peer, isNewPeer);
    } catch (error) {
      console.error('Error in discovery callback:', error);
    }
  });
  
  console.log(`${isNewPeer ? 'Discovered new peer' : 'Updated peer'}: ${peer.hostname} (${peerId})`);
}

/**
 * Register a callback for peer discovery events
 * 
 * @param {Function} callback - Function to call when a peer is discovered
 *                             Callback receives (peer, isNewPeer) parameters
 */
function onPeerDiscovered(callback) {
  discoveryCallbacks.push(callback);
  
  // Return unsubscribe function
  return () => {
    const index = discoveryCallbacks.indexOf(callback);
    if (index > -1) {
      discoveryCallbacks.splice(index, 1);
    }
  };
}

/**
 * Get all discovered peers
 * 
 * @returns {Array} Array of discovered peer objects
 */
function getDiscoveredPeers() {
  return Array.from(discoveredPeers.values());
}

/**
 * Get a specific peer by ID
 * 
 * @param {string} peerId - The peer ID to look for
 * @returns {Object|null} The peer object or null if not found
 */
function getPeerById(peerId) {
  return discoveredPeers.get(peerId) || null;
}

/**
 * Remove a peer from the discovered peers list
 * 
 * @param {string} peerId - The peer ID to remove
 */
function removePeer(peerId) {
  const peer = discoveredPeers.get(peerId);
  if (peer) {
    discoveredPeers.delete(peerId);
    console.log(`Removed peer: ${peer.hostname} (${peerId})`);
  }
}

/**
 * Clean up old peers that haven't been seen recently
 * 
 * @param {number} maxAge - Maximum age in milliseconds (default: 30 seconds)
 */
function cleanupOldPeers(maxAge = 30000) {
  const now = Date.now();
  const peersToRemove = [];
  
  discoveredPeers.forEach((peer, peerId) => {
    if (now - peer.lastSeen > maxAge) {
      peersToRemove.push(peerId);
    }
  });
  
  peersToRemove.forEach(peerId => {
    removePeer(peerId);
  });
  
  if (peersToRemove.length > 0) {
    console.log(`Cleaned up ${peersToRemove.length} old peers`);
  }
}

/**
 * Update peer status
 * 
 * @param {string} peerId - The peer ID
 * @param {string} status - New status ('discovered', 'connecting', 'connected', 'disconnected')
 */
function updatePeerStatus(peerId, status) {
  const peer = discoveredPeers.get(peerId);
  if (peer) {
    peer.status = status;
    peer.lastSeen = Date.now();
    
    // Notify callbacks about the status update
    discoveryCallbacks.forEach(callback => {
      try {
        callback(peer, false); // false because it's not a new peer
      } catch (error) {
        console.error('Error in discovery callback:', error);
      }
    });
  }
}

// Start cleanup interval for old peers
setInterval(() => {
  cleanupOldPeers();
}, 10000); // Clean up every 10 seconds

// Initialize discovery when module loads
initializeDiscovery();

export {
  onPeerDiscovered,
  getDiscoveredPeers,
  getPeerById,
  removePeer,
  updatePeerStatus,
  cleanupOldPeers
};

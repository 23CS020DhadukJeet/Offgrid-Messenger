/**
 * server.js - Main server file for IP Messenger Clone
 * 
 * This file sets up and manages both the WebSocket server for peer-to-peer messaging
 * and UDP broadcasting for automatic peer discovery on the local network.
 */

const WebSocket = require('ws');
const dgram = require('dgram');
const os = require('os');
const http = require('http');
const url = require('url');
const { encryptMessage, decryptMessage } = require('./encryption');
const { addPeer, removePeer, getPeers, broadcastToPeers } = require('./peers');
const { handleFileTransferRequest } = require('./fileTransfer');
const { registerUser, loginUser, getUserById, updateUser } = require('./userAuth');

// Configuration
const WS_PORT = 8080;
const HTTP_PORT = 8080; // Using same port for HTTP and WebSocket
const UDP_PORT = 8081;
const BROADCAST_INTERVAL = 5000; // milliseconds

// Get local IP address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip over non-IPv4 and internal (loopback) addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1'; // Fallback to localhost if no other IP is found
}

const localIp = getLocalIpAddress();
const hostname = os.hostname();

// Create HTTP server
const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Parse URL
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // Handle API endpoints
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        const result = registerUser(username, password);
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(result.success ? 200 : 400);
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, message: 'Invalid request' }));
      }
    });
  } else if (pathname === '/api/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        const result = loginUser(username, password);
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(result.success ? 200 : 401);
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, message: 'Invalid request' }));
      }
    });
  } else {
    // Not found
    res.writeHead(404);
    res.end(JSON.stringify({ success: false, message: 'Not found' }));
  }
});

// Initialize WebSocket server on the same HTTP server
const wss = new WebSocket.Server({ server });
console.log(`HTTP and WebSocket server running at http://${localIp}:${HTTP_PORT}`);

// Initialize UDP socket for discovery
const udpSocket = dgram.createSocket('udp4');

// Start the server
server.listen(HTTP_PORT);

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress.replace(/^::ffff:/, '');
  console.log(`New WebSocket connection from ${clientIp}`);
  
  // Add the new peer to our list
  const peerId = `${clientIp}:${WS_PORT}`;
  addPeer(peerId, ws, clientIp);
  
  // Send the current peer list to the new peer
  const peerListMessage = {
    type: 'peer_list',
    peers: getPeers().map(peer => ({
      id: peer.id,
      ip: peer.ip,
      hostname: peer.hostname || 'Unknown'
    }))
  };
  
  ws.send(encryptMessage(JSON.stringify(peerListMessage)));
  
  // Broadcast to all peers that a new peer has joined
  const newPeerMessage = {
    type: 'peer_joined',
    peer: {
      id: peerId,
      ip: clientIp,
      hostname: hostname
    }
  };
  
  broadcastToPeers(JSON.stringify(newPeerMessage), peerId);
  
  // Handle messages from this peer
  ws.on('message', (message) => {
    try {
      const decryptedMessage = decryptMessage(message.toString());
      const parsedMessage = JSON.parse(decryptedMessage);
      
      switch (parsedMessage.type) {
        case 'chat':
          // Handle chat message
          console.log(`Chat message from ${peerId}: ${parsedMessage.content}`);
          
          // If the message has a specific target, send only to that peer
          if (parsedMessage.to) {
            const targetPeer = getPeers().find(p => p.id === parsedMessage.to);
            if (targetPeer && targetPeer.socket.readyState === WebSocket.OPEN) {
              const forwardedMessage = {
                type: 'chat',
                from: peerId,
                content: parsedMessage.content,
                timestamp: Date.now()
              };
              targetPeer.socket.send(encryptMessage(JSON.stringify(forwardedMessage)));
            }
          } else {
            // Otherwise broadcast to all peers
            const broadcastMessage = {
              type: 'chat',
              from: peerId,
              content: parsedMessage.content,
              timestamp: Date.now()
            };
            broadcastToPeers(JSON.stringify(broadcastMessage), peerId);
          }
          break;
          
        case 'file_request':
          // Handle file transfer request
          handleFileTransferRequest(parsedMessage, peerId);
          break;
          
        case 'clipboard':
          // Handle clipboard sharing
          console.log(`Clipboard content received from ${peerId}`);
          const clipboardMessage = {
            type: 'clipboard',
            from: peerId,
            content: parsedMessage.content,
            timestamp: Date.now()
          };
          
          // If there's a specific recipient, send only to them
          if (parsedMessage.to) {
            const targetPeer = getPeers().find(p => p.id === parsedMessage.to);
            if (targetPeer && targetPeer.socket.readyState === WebSocket.OPEN) {
              targetPeer.socket.send(encryptMessage(JSON.stringify(clipboardMessage)));
            }
          } else {
            // Otherwise broadcast to all peers
            broadcastToPeers(JSON.stringify(clipboardMessage), peerId);
          }
          break;
          
        default:
          console.log(`Unknown message type from ${peerId}: ${parsedMessage.type}`);
      }
    } catch (error) {
      console.error(`Error processing message from ${peerId}:`, error);
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log(`WebSocket connection closed for ${peerId}`);
    removePeer(peerId);
    
    // Broadcast to all peers that this peer has left
    const peerLeftMessage = {
      type: 'peer_left',
      peerId: peerId
    };
    
    broadcastToPeers(JSON.stringify(peerLeftMessage));
  });
});

// Set up UDP socket for peer discovery
udpSocket.on('error', (err) => {
  console.error(`UDP socket error: ${err.message}`);
  udpSocket.close();
});

udpSocket.on('message', (msg, rinfo) => {
  try {
    const message = JSON.parse(msg.toString());
    
    if (message.type === 'discovery') {
      console.log(`Discovery message from ${rinfo.address}:${rinfo.port}`);
      
      // Send a response with our information
      const response = {
        type: 'discovery_response',
        ip: localIp,
        port: WS_PORT,
        hostname: hostname
      };
      
      const responseBuffer = Buffer.from(JSON.stringify(response));
      udpSocket.send(responseBuffer, 0, responseBuffer.length, rinfo.port, rinfo.address);
    }
  } catch (error) {
    console.error('Error processing UDP message:', error);
  }
});

// Bind UDP socket
udpSocket.bind(UDP_PORT, () => {
  console.log(`UDP discovery service running on port ${UDP_PORT}`);
  
  // Enable broadcast
  udpSocket.setBroadcast(true);
  
  // Start broadcasting discovery messages
  setInterval(() => {
    const discoveryMessage = {
      type: 'discovery',
      ip: localIp,
      port: WS_PORT,
      hostname: hostname
    };
    
    const messageBuffer = Buffer.from(JSON.stringify(discoveryMessage));
    
    // Broadcast to the LAN
    udpSocket.send(messageBuffer, 0, messageBuffer.length, UDP_PORT, '255.255.255.255');
  }, BROADCAST_INTERVAL);
});

// Export server for potential use in other modules
module.exports = {
  wss,
  udpSocket,
  localIp,
  WS_PORT,
  UDP_PORT
};
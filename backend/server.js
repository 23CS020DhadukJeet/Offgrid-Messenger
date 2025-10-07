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
const { 
  createGroup, 
  getGroup, 
  getUserGroups, 
  addMemberToGroup, 
  removeMemberFromGroup, 
  isGroupMember, 
  addGroupMessage, 
  getGroupMessages, 
  addGroupFileTransfer, 
  getGroupFileTransfers, 
  deleteGroup, 
  getGroupFilePath, 
  broadcastToGroupMembers 
} = require('./groupManager');
const {
  createGeneralAnnouncement,
  createGroupAnnouncement,
  getGeneralAnnouncements,
  getGroupAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getUserVisibleAnnouncements
} = require('./bulletinBoard');

// Configuration
const WS_PORT = 8080;
const HTTP_PORT = 8080; // Using same port for HTTP and WebSocket
const UDP_PORT = 8081;
const BROADCAST_INTERVAL = 5000; // milliseconds
const MAX_RETRY_ATTEMPTS = 3;

// Initialize connection retry mechanism
const retryConnections = new Map(); // Store failed connection attempts

// Function to add a connection to retry queue
function addConnectionRetry(ip, port, attempts = 0) {
  const key = `${ip}:${port}`;
  if (!retryConnections.has(key) && attempts < MAX_RETRY_ATTEMPTS) {
    console.log(`Adding ${key} to connection retry queue (attempt ${attempts + 1})`);
    retryConnections.set(key, {
      ip,
      port,
      attempts: attempts + 1,
      nextRetry: Date.now() + (attempts + 1) * 5000 // Exponential backoff
    });
  }
}

// Get all local IP addresses
function getAllLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip over non-IPv4 and internal (loopback) addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          address: iface.address,
          netmask: iface.netmask,
          name: name
        });
      }
    }
  }
  
  // If no addresses found, add localhost
  if (addresses.length === 0) {
    addresses.push({
      address: '127.0.0.1',
      netmask: '255.0.0.0',
      name: 'loopback'
    });
  }
  
  return addresses;
}

// Get primary local IP address
function getLocalIpAddress() {
  const addresses = getAllLocalIpAddresses();
  return addresses.length > 0 ? addresses[0].address : '127.0.0.1';
}

// Calculate subnet broadcast address
function getSubnetBroadcast(ipAddress, netmask) {
  const ip = ipAddress.split('.').map(Number);
  const mask = netmask.split('.').map(Number);
  const broadcast = [];
  
  for (let i = 0; i < 4; i++) {
    // For each octet, calculate the broadcast address
    broadcast.push(ip[i] | (~mask[i] & 255));
  }
  
  return broadcast.join('.');
}

const localIpAddresses = getAllLocalIpAddresses();
const localIp = getLocalIpAddress();
const hostname = os.hostname();

// Create HTTP server
const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
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
  } else if (pathname === '/api/groups' && req.method === 'POST') {
    // Create new group
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { groupName, creatorId, memberIds } = JSON.parse(body);
        const group = createGroup(groupName, creatorId, memberIds || []);
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, group }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, message: 'Invalid request' }));
      }
    });
  } else if ((pathname === '/api/groups' || pathname.startsWith('/api/groups/')) && req.method === 'GET') {
    // Get user groups or specific group
    const pathParts = pathname.split('/');
    if (pathParts.length === 3) {
      // Get user groups
      const userId = parsedUrl.query.userId;
      if (!userId) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, message: 'User ID required' }));
        return;
      }
      
      const userGroups = getUserGroups(userId);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, groups: userGroups }));
    } else if (pathParts.length === 4) {
      // Get specific group
      const groupId = pathParts[3];
      const group = getGroup(groupId);
      
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(group ? 200 : 404);
      res.end(JSON.stringify({ success: !!group, group }));
    }
  } else if (pathname.startsWith('/api/groups/') && pathname.includes('/members') && req.method === 'POST') {
    // Add member to group
    const pathParts = pathname.split('/');
    const groupId = pathParts[3];
    
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { userId, addedBy } = JSON.parse(body);
        const success = addMemberToGroup(groupId, userId, addedBy);
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(success ? 200 : 400);
        res.end(JSON.stringify({ success }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, message: 'Invalid request' }));
      }
    });
  } else if (pathname.startsWith('/api/groups/') && pathname.includes('/members') && req.method === 'DELETE') {
    // Remove member from group
    const pathParts = pathname.split('/');
    const groupId = pathParts[3];
    
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { userId, removedBy } = JSON.parse(body);
        const success = removeMemberFromGroup(groupId, userId, removedBy);
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(success ? 200 : 400);
        res.end(JSON.stringify({ success }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, message: 'Invalid request' }));
      }
    });
  } else if (pathname === '/api/bulletins/general' && req.method === 'POST') {
    // Create general announcement
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { title, content, authorId, priority } = JSON.parse(body);
        const announcement = createGeneralAnnouncement(title, content, authorId, priority);
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, announcement }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, message: 'Invalid request' }));
      }
    });
  } else if (pathname === '/api/bulletins/general' && req.method === 'GET') {
    // Get all general announcements
    const announcements = getGeneralAnnouncements();
    
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, announcements }));
  } else if (pathname.startsWith('/api/bulletins/general/') && req.method === 'GET') {
    // Get specific general announcement
    const pathParts = pathname.split('/');
    const announcementId = pathParts[4];
    const announcement = getAnnouncement(announcementId);
    
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(announcement ? 200 : 404);
    res.end(JSON.stringify({ success: !!announcement, announcement }));
  } else if (pathname.startsWith('/api/bulletins/general/') && req.method === 'PUT') {
    // Update general announcement
    const pathParts = pathname.split('/');
    const announcementId = pathParts[4];
    
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const updates = JSON.parse(body);
        const updatedAnnouncement = updateAnnouncement(announcementId, updates);
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(updatedAnnouncement ? 200 : 404);
        res.end(JSON.stringify({ success: !!updatedAnnouncement, announcement: updatedAnnouncement }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, message: 'Invalid request' }));
      }
    });
  } else if (pathname.startsWith('/api/bulletins/general/') && req.method === 'DELETE') {
    // Delete general announcement
    const pathParts = pathname.split('/');
    const announcementId = pathParts[4];
    const success = deleteAnnouncement(announcementId);
    
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(success ? 200 : 404);
    res.end(JSON.stringify({ success }));
  } else if (pathname.startsWith('/api/bulletins/group') && req.method === 'POST') {
    // Create group announcement
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { title, content, authorId, groupId, priority } = JSON.parse(body);
        const announcement = createGroupAnnouncement(title, content, authorId, groupId, priority);
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, announcement }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, message: 'Invalid request' }));
      }
    });
  } else if (pathname.startsWith('/api/bulletins/group/') && pathname.includes('/announcements') && req.method === 'GET') {
    // Get group announcements
    const pathParts = pathname.split('/');
    const groupId = pathParts[4];
    const announcements = getGroupAnnouncements(groupId);
    
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, announcements }));
  } else if (pathname.startsWith('/api/bulletins/group/') && pathname.includes('/announcements/') && req.method === 'GET') {
    // Get specific group announcement
    const pathParts = pathname.split('/');
    const groupId = pathParts[4];
    const announcementId = pathParts[6];
    const announcement = getAnnouncement(announcementId, groupId);
    
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(announcement ? 200 : 404);
    res.end(JSON.stringify({ success: !!announcement, announcement }));
  } else if (pathname.startsWith('/api/bulletins/group/') && pathname.includes('/announcements/') && req.method === 'PUT') {
    // Update group announcement
    const pathParts = pathname.split('/');
    const groupId = pathParts[4];
    const announcementId = pathParts[6];
    
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const updates = JSON.parse(body);
        const updatedAnnouncement = updateAnnouncement(announcementId, updates, groupId);
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(updatedAnnouncement ? 200 : 404);
        res.end(JSON.stringify({ success: !!updatedAnnouncement, announcement: updatedAnnouncement }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, message: 'Invalid request' }));
      }
    });
  } else if (pathname.startsWith('/api/bulletins/group/') && pathname.includes('/announcements/') && req.method === 'DELETE') {
    // Delete group announcement
    const pathParts = pathname.split('/');
    const groupId = pathParts[4];
    const announcementId = pathParts[6];
    const success = deleteAnnouncement(announcementId, groupId);
    
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(success ? 200 : 404);
    res.end(JSON.stringify({ success }));
  } else if (pathname === '/api/peers/connect' && req.method === 'POST') {
     // Manual peer connection endpoint
     let body = '';
     req.on('data', chunk => {
       body += chunk.toString();
     });
     req.on('end', () => {
       try {
         const { ip, port } = JSON.parse(body);
         
         if (!ip || !port) {
           res.writeHead(400, { 'Content-Type': 'application/json' });
           res.end(JSON.stringify({ success: false, message: 'IP address and port are required' }));
           return;
         }
         
         // Attempt to connect to the peer
         const peerUrl = `ws://${ip}:${port}`;
         console.log(`Attempting manual connection to peer at ${peerUrl}`);
         
         // Set response headers first
         res.setHeader('Content-Type', 'application/json');
         
         // Create a new WebSocket connection to the peer
         try {
           const ws = new WebSocket(peerUrl);
           
           // Set a timeout for connection
           const connectionTimeout = setTimeout(() => {
             if (ws.readyState !== WebSocket.OPEN) {
               ws.terminate();
               res.writeHead(500);
               res.end(JSON.stringify({ success: false, message: 'Connection timeout' }));
             }
           }, 5000);
           
           ws.on('open', () => {
             clearTimeout(connectionTimeout);
             const peerId = `${ip}:${port}`;
             addPeer(peerId, ws, ip);
             
             res.writeHead(200);
             res.end(JSON.stringify({ success: true, message: 'Connected to peer successfully' }));
           });
           
           ws.on('error', (error) => {
             clearTimeout(connectionTimeout);
             console.error(`Failed to connect to peer at ${peerUrl}:`, error.message);
             res.writeHead(500);
             res.end(JSON.stringify({ success: false, message: 'Failed to connect to peer: ' + error.message }));
             // Add to retry queue for later connection attempts
             addConnectionRetry(ip, port);
           });
         } catch (wsError) {
           console.error('WebSocket creation error:', wsError);
           res.writeHead(500);
           res.end(JSON.stringify({ success: false, message: 'Failed to create WebSocket connection: ' + wsError.message }));
           // Add to retry queue for later connection attempts
           addConnectionRetry(ip, port);
         }
       } catch (error) {
         console.error('Request parsing error:', error);
         res.writeHead(400, { 'Content-Type': 'application/json' });
         res.end(JSON.stringify({ success: false, message: 'Invalid request: ' + error.message }));
       }
     });
  } else if (pathname === '/api/peers/discover' && req.method === 'POST') {
     // Manual peer discovery endpoint
     console.log('Manual peer discovery triggered');
     
     // Send discovery messages to all network interfaces
     const discoveryMessage = {
       type: 'discovery',
       ip: localIp,
       port: WS_PORT,
       hostname: hostname
     };
     
     const messageBuffer = Buffer.from(JSON.stringify(discoveryMessage));
     
     // Broadcast to all network interfaces
     for (const iface of localIpAddresses) {
       try {
         // Calculate subnet broadcast address for this interface
         const subnetBroadcast = getSubnetBroadcast(iface.address, iface.netmask);
         console.log(`Broadcasting to subnet ${subnetBroadcast} on interface ${iface.name}`);
         
         // Send to subnet broadcast address
         udpSocket.send(messageBuffer, 0, messageBuffer.length, UDP_PORT, subnetBroadcast);
       } catch (error) {
         console.error(`Error broadcasting on interface ${iface.name}:`, error);
       }
     }
     
     // Also try direct broadcast as fallback
     udpSocket.send(messageBuffer, 0, messageBuffer.length, UDP_PORT, '255.255.255.255');
     
     res.setHeader('Content-Type', 'application/json');
     res.writeHead(200);
     res.end(JSON.stringify({ success: true, message: 'Peer discovery initiated' }));

  } else if (pathname === '/api/bulletins/user' && req.method === 'GET') {
    // Get all announcements visible to a user
    const userId = parsedUrl.query.userId;
    const userGroupIds = parsedUrl.query.groupIds ? parsedUrl.query.groupIds.split(',') : [];
    
    if (!userId) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, message: 'User ID required' }));
      return;
    }
    
    const announcements = getUserVisibleAnnouncements(userId, userGroupIds);
    
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, announcements }));
  } else if (pathname.startsWith('/api/groups/') && pathname.includes('/messages') && req.method === 'GET') {
    // Get group messages
    const pathParts = pathname.split('/');
    const groupId = pathParts[3];
    const userId = parsedUrl.query.userId;
    const limit = parseInt(parsedUrl.query.limit) || 100;
    
    if (!userId) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, message: 'User ID required' }));
      return;
    }
    
    const messages = getGroupMessages(groupId, userId, limit);
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, messages }));
  } else if (pathname.startsWith('/api/groups/') && pathname.includes('/files') && req.method === 'GET') {
    // Get group file transfers
    const pathParts = pathname.split('/');
    const groupId = pathParts[3];
    const userId = parsedUrl.query.userId;
    
    if (!userId) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, message: 'User ID required' }));
      return;
    }
    
    const files = getGroupFileTransfers(groupId, userId);
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, files }));
  } else if (pathname.startsWith('/api/groups/') && req.method === 'DELETE') {
    // Delete group
    const pathParts = pathname.split('/');
    const groupId = pathParts[3];
    
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { userId } = JSON.parse(body);
        const success = deleteGroup(groupId, userId);
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(success ? 200 : 400);
        res.end(JSON.stringify({ success }));
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

// WebSocket message types
const MESSAGE_TYPES = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  MESSAGE: 'message',
  FILE_REQUEST: 'file_request',
  FILE_CHUNK: 'file_chunk',
  FILE_COMPLETE: 'file_complete',
  GROUP_MESSAGE: 'group_message',
  GROUP_FILE_REQUEST: 'group_file_request',
  GROUP_FILE_CHUNK: 'group_file_chunk',
  GROUP_FILE_COMPLETE: 'group_file_complete',
  GENERAL_ANNOUNCEMENT: 'general_announcement',
  GROUP_ANNOUNCEMENT: 'group_announcement',
  ERROR: 'error'
};

// Handle general announcement
function handleGeneralAnnouncement(ws, data) {
  const { title, content, from, priority } = data;
  
  // Create the announcement
  const announcement = createGeneralAnnouncement(title, content, from, priority || 'medium');
  
  // Broadcast to all peers
  broadcastToPeers(JSON.stringify({
    type: MESSAGE_TYPES.GENERAL_ANNOUNCEMENT,
    announcement,
    from
  }));
}

// Handle group announcement
function handleGroupAnnouncement(ws, data) {
  const { groupId, title, content, from, priority } = data;
  
  // Verify user is member of group
  if (!isGroupMember(groupId, from)) {
    ws.send(JSON.stringify({
      type: MESSAGE_TYPES.ERROR,
      message: 'You are not a member of this group'
    }));
    return;
  }
  
  // Create the announcement
  const announcement = createGroupAnnouncement(title, content, from, groupId, priority || 'medium');
  
  // Broadcast to all group members
  broadcastToGroupMembers(groupId, {
    type: MESSAGE_TYPES.GROUP_ANNOUNCEMENT,
    groupId,
    announcement,
    from
  }, (memberId, message) => {
    const targetPeer = getPeers().find(p => p.id === memberId);
    if (targetPeer && targetPeer.socket.readyState === WebSocket.OPEN) {
      return targetPeer.socket.send(encryptMessage(JSON.stringify(message)));
    }
    return false;
  });
}

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
          
        case 'group_chat':
          // Handle group chat message
          console.log(`Group chat message from ${peerId} to group ${parsedMessage.groupId}`);
          
          // Verify user is member of group
          if (!isGroupMember(parsedMessage.groupId, peerId)) {
            console.log(`User ${peerId} is not a member of group ${parsedMessage.groupId}`);
            break;
          }
          
          // Add message to group
          const groupMessage = {
            type: 'group_chat',
            groupId: parsedMessage.groupId,
            senderId: peerId,
            content: parsedMessage.content,
            timestamp: Date.now()
          };
          
          if (addGroupMessage(parsedMessage.groupId, groupMessage)) {
            // Broadcast to all group members
            broadcastToGroupMembers(parsedMessage.groupId, groupMessage, (memberId, message) => {
              const targetPeer = getPeers().find(p => p.id === memberId);
              if (targetPeer && targetPeer.socket.readyState === WebSocket.OPEN) {
                return targetPeer.socket.send(encryptMessage(message));
              }
              return false;
            });
          }
          break;
          
        case 'group_file_request':
          // Handle group file transfer request
          console.log(`Group file transfer request from ${peerId} to group ${parsedMessage.groupId}`);
          
          // Verify user is member of group
          if (!isGroupMember(parsedMessage.groupId, peerId)) {
            console.log(`User ${peerId} is not a member of group ${parsedMessage.groupId}`);
            break;
          }
          
          // Add file transfer to group
          const groupFileTransfer = {
            transferId: parsedMessage.transferId,
            fileName: parsedMessage.fileName,
            fileSize: parsedMessage.fileSize,
            senderId: peerId,
            groupId: parsedMessage.groupId,
            timestamp: Date.now()
          };
          
          if (addGroupFileTransfer(parsedMessage.groupId, groupFileTransfer)) {
            // Broadcast to all group members
            const fileRequestMessage = {
              type: 'group_file_request',
              groupId: parsedMessage.groupId,
              transferId: parsedMessage.transferId,
              fileName: parsedMessage.fileName,
              fileSize: parsedMessage.fileSize,
              senderId: peerId,
              timestamp: Date.now()
            };
            
            broadcastToGroupMembers(parsedMessage.groupId, fileRequestMessage, (memberId, message) => {
              const targetPeer = getPeers().find(p => p.id === memberId);
              if (targetPeer && targetPeer.socket.readyState === WebSocket.OPEN) {
                return targetPeer.socket.send(encryptMessage(message));
              }
              return false;
            });
          }
          break;
          
        case 'general_announcement':
          // Handle general announcement
          console.log(`General announcement from ${peerId}: ${parsedMessage.title}`);
          
          // Create the announcement
          const generalAnnouncement = createGeneralAnnouncement(
            parsedMessage.title,
            parsedMessage.content,
            peerId,
            parsedMessage.priority || 'normal'
          );
          
          // Broadcast to all peers
          const announcementMessage = {
            type: 'general_announcement',
            from: peerId,
            announcement: generalAnnouncement,
            timestamp: Date.now()
          };
          
          broadcastToPeers(JSON.stringify(announcementMessage));
          break;
          
        case 'group_announcement':
          // Handle group announcement
          console.log(`Group announcement from ${peerId} to group ${parsedMessage.groupId}`);
          
          // Verify user is member of group
          if (!isGroupMember(parsedMessage.groupId, peerId)) {
            console.log(`User ${peerId} is not a member of group ${parsedMessage.groupId}`);
            break;
          }
          
          // Create the announcement
          const groupAnnouncement = createGroupAnnouncement(
            parsedMessage.title,
            parsedMessage.content,
            peerId,
            parsedMessage.groupId,
            parsedMessage.priority || 'normal'
          );
          
          // Broadcast to all group members
          const groupAnnouncementMessage = {
            type: 'group_announcement',
            groupId: parsedMessage.groupId,
            from: peerId,
            announcement: groupAnnouncement,
            timestamp: Date.now()
          };
          
          broadcastToGroupMembers(parsedMessage.groupId, groupAnnouncementMessage, (memberId, message) => {
            const targetPeer = getPeers().find(p => p.id === memberId);
            if (targetPeer && targetPeer.socket.readyState === WebSocket.OPEN) {
              return targetPeer.socket.send(encryptMessage(message));
            }
            return false;
          });
          break;
          
        case 'group_file_chunk':
          // Handle group file chunk
          console.log(`Group file chunk received from ${peerId} for group ${parsedMessage.groupId}`);
          
          // Verify user is member of group
          if (!isGroupMember(parsedMessage.groupId, peerId)) {
            console.log(`User ${peerId} is not a member of group ${parsedMessage.groupId}`);
            break;
          }
          
          // Broadcast chunk to all group members except sender
          const chunkMessage = {
            type: 'group_file_chunk',
            groupId: parsedMessage.groupId,
            transferId: parsedMessage.transferId,
            chunkIndex: parsedMessage.chunkIndex,
            totalChunks: parsedMessage.totalChunks,
            chunkSize: parsedMessage.chunkSize,
            data: parsedMessage.data,
            senderId: peerId,
            timestamp: Date.now()
          };
          
          broadcastToGroupMembers(parsedMessage.groupId, chunkMessage, (memberId, message) => {
            // Don't send back to sender
            if (memberId === peerId) return false;
            
            const targetPeer = getPeers().find(p => p.id === memberId);
            if (targetPeer && targetPeer.socket.readyState === WebSocket.OPEN) {
              return targetPeer.socket.send(encryptMessage(message));
            }
            return false;
          });
          break;
          
        case 'group_file_complete':
          // Handle group file transfer completion
          console.log(`Group file transfer completed from ${peerId} for group ${parsedMessage.groupId}`);
          
          // Verify user is member of group
          if (!isGroupMember(parsedMessage.groupId, peerId)) {
            console.log(`User ${peerId} is not a member of group ${parsedMessage.groupId}`);
            break;
          }
          
          // Broadcast completion to all group members except sender
          const completeMessage = {
            type: 'group_file_complete',
            groupId: parsedMessage.groupId,
            transferId: parsedMessage.transferId,
            senderId: peerId,
            timestamp: Date.now()
          };
          
          broadcastToGroupMembers(parsedMessage.groupId, completeMessage, (memberId, message) => {
            // Don't send back to sender
            if (memberId === peerId) return false;
            
            const targetPeer = getPeers().find(p => p.id === memberId);
            if (targetPeer && targetPeer.socket.readyState === WebSocket.OPEN) {
              return targetPeer.socket.send(encryptMessage(message));
            }
            return false;
          });
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
      // Don't respond to our own discovery messages
      if (rinfo.address === localIp || (message.hostname && message.hostname === hostname)) {
        return;
      }
      
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
      
      // Try to connect to the peer via WebSocket
      connectToPeer(rinfo.address, message.port || WS_PORT);
    } else if (message.type === 'discovery_response') {
      console.log(`Discovery response from ${message.hostname || rinfo.address}:${message.port}`);
      connectToPeer(rinfo.address, message.port || WS_PORT);
    }
  } catch (error) {
    console.error('Error processing UDP message:', error);
  }
});

// Function to connect to a peer via WebSocket
function connectToPeer(ip, port) {
  // Check if we're already connected to this peer
  const peerId = `${ip}:${port}`;
  const existingPeer = getPeers().find(p => p.id === peerId);
  if (existingPeer) {
    console.log(`Already connected to peer at ${ip}:${port}`);
    return;
  }
  
  console.log(`Connecting to peer at ${ip}:${port}`);
  
  try {
    const ws = new WebSocket(`ws://${ip}:${port}`);
    
    ws.on('open', () => {
      console.log(`Connected to peer at ${ip}:${port}`);
      addPeer(peerId, ws, ip);
      
      // Remove from retry queue if it was there
      if (retryConnections && retryConnections.has(peerId)) {
        retryConnections.delete(peerId);
      }
    });
    
    ws.on('error', (error) => {
      console.error(`Failed to connect to peer at ${ip}:${port}:`, error.message);
      // Add to retry queue
      if (retryConnections) {
        addConnectionRetry(ip, port);
      }
    });
  } catch (error) {
    console.error(`Error creating WebSocket connection to ${ip}:${port}:`, error.message);
    // Add to retry queue
    if (retryConnections) {
      addConnectionRetry(ip, port);
    }
  }
}

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
    
    // Broadcast to all network interfaces
     for (const iface of localIpAddresses) {
       try {
         // Calculate subnet broadcast address for this interface
         const subnetBroadcast = getSubnetBroadcast(iface.address, iface.netmask);
         console.log(`Broadcasting to subnet ${subnetBroadcast} on interface ${iface.name}`);
         
         // Send to subnet broadcast address
         udpSocket.send(messageBuffer, 0, messageBuffer.length, UDP_PORT, subnetBroadcast);
         
         // Also try direct broadcast as fallback
         udpSocket.send(messageBuffer, 0, messageBuffer.length, UDP_PORT, '255.255.255.255');
       } catch (error) {
         console.error(`Error broadcasting on interface ${iface.name}:`, error);
       }
     }
     
     // Additional discovery method: Try to reach common gateway addresses
     const gatewayAddresses = ['192.168.0.1', '192.168.1.1', '192.168.43.1', '10.0.0.1', '10.0.0.138'];
     for (const gateway of gatewayAddresses) {
       try {
         udpSocket.send(messageBuffer, 0, messageBuffer.length, UDP_PORT, gateway);
       } catch (error) {
         // Silently ignore errors for gateway addresses
       }
     }
     
     // Scan common IP ranges in LAN for direct peer discovery
     // This helps in environments where broadcast packets are blocked
     const ipBase = localIp.split('.').slice(0, 3).join('.');
     for (let i = 1; i < 255; i++) {
       if (i % 10 === 0) { // Only scan every 10th IP to reduce traffic
         const targetIp = `${ipBase}.${i}`;
         // Don't scan our own IP
         if (targetIp !== localIp) {
           try {
             udpSocket.send(messageBuffer, 0, messageBuffer.length, UDP_PORT, targetIp);
           } catch (error) {
             // Silently ignore errors for direct IP scanning
           }
         }
       }
     }
  }, BROADCAST_INTERVAL);
  
  // Process connection retry queue every 10 seconds
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of retryConnections.entries()) {
      if (now >= data.nextRetry) {
        console.log(`Retrying connection to ${key} (attempt ${data.attempts})`); 
        
        // Remove from retry queue
        retryConnections.delete(key);
        
        // Attempt to connect
        connectToPeer(data.ip, data.port);
      }
    }
  }, 10000);
});

// Export server for potential use in other modules
module.exports = {
  wss,
  udpSocket,
  localIp,
  WS_PORT,
  UDP_PORT
};
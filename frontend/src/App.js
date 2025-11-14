/**
 * App.js - Main application component
 * 
 * This component serves as the entry point for the UI and manages
 * the overall layout and state of the application.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

// Import NotificationManager
import NotificationManager from './components/NotificationManager';

// Import components
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import GroupChat from './components/GroupChat';
import GroupManager from './components/GroupManager';
import FileTransferHistory from './components/FileTransferHistory';
import ConnectionStatus from './components/ConnectionStatus';
import Settings from './components/Settings';
import Login from './components/Login';
import BulletinBoard from './components/BulletinBoard';
import BulletinNotification from './components/BulletinNotification';
import CallInterface from './components/CallInterface';
import CallNotification from './components/CallNotification';

// Import auth service
import { isLoggedIn, getCurrentUser, logoutUser } from './services/authService';

// Import WebSocket service
import { initializeWebSocket, sendMessage, closeWebSocket, connectToPeer, sendMessageToPeer, isConnectedToPeer } from './services/websocketService';

// Import discovery service
import { onPeerDiscovered, getDiscoveredPeers } from './services/discoveryService';

// Import group services
import { 
  createGroup, 
  getUserGroups, 
  sendGroupMessage 
} from './services/groupService';

// Import bulletin board service
import {
  getGeneralAnnouncements,
  getGroupAnnouncements,
  getUserVisibleAnnouncements
} from './services/bulletinService';
import { 
  sendFileToGroup as sendFileToGroupService, 
  handleGroupFileRequest, 
  handleGroupFileChunk, 
  handleGroupFileComplete,
  getActiveGroupTransfers 
} from './services/groupFileService';

// Import call service
import {
  initializeCallService,
  initiateCall,
  initiateGroupCall,
  acceptCall,
  rejectCall,
  endCall,
  getLocalStream,
  handleCallMessage,
  isCallActive,
  toggleAudioMute,
  toggleVideo
} from './services/callService';

// Import file transfer history service
import { 
  addFileTransferToHistory, 
  updateFileTransferInHistory 
} from './services/fileTransferHistoryService';

function App() {
  // State for user authentication
  const [isAuthenticated, setIsAuthenticated] = useState(isLoggedIn());
  const [user, setUser] = useState(getCurrentUser());
  
  // State for managing peers
  const [peers, setPeers] = useState([]);
  const [selectedPeer, setSelectedPeer] = useState(null);
  
  // State for managing groups
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMessages, setGroupMessages] = useState({});
  const [groupFileTransfers, setGroupFileTransfers] = useState([]);
  
  // State for managing messages
  const [messages, setMessages] = useState({});
  
  // State for connection status
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  
  // State for notifications
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  
  // State for in-app notifications
  const [notifications, setNotifications] = useState([]);
  
  // State for file transfers
  const [fileTransfers, setFileTransfers] = useState([]);
  
  // State for settings dialog
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // State for group manager dialog
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  
  // State for file transfer history dialog
  const [fileTransferHistoryOpen, setFileTransferHistoryOpen] = useState(false);
  
  // State for bulletin board dialog
  const [bulletinBoardOpen, setBulletinBoardOpen] = useState(false);
  
  // State for bulletin board announcements
  const [announcements, setAnnouncements] = useState([]);
  
  // State for theme mode
  const [darkMode, setDarkMode] = useState(false);
  
  // State for username
  const [username, setUsername] = useState(user ? user.username : 'User');
  const [pendingAuthPeerId, setPendingAuthPeerId] = useState(null);
  
  // State for call management
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  
  // Create theme based on mode
  const theme = useMemo(() => createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#3f51b5',
      },
      secondary: {
        main: '#f50057',
      },
      background: {
        default: darkMode ? '#303030' : '#f5f5f5',
        paper: darkMode ? '#424242' : '#ffffff',
      },
      success: {
        main: '#4caf50',
      },
      error: {
        main: '#f44336',
      },
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      h6: {
        fontWeight: 600,
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 500,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)',
          },
        },
      },
      MuiListItem: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            marginBottom: 4,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            '&.Mui-selected': {
              backgroundColor: darkMode ? 'rgba(63, 81, 181, 0.16)' : 'rgba(63, 81, 181, 0.08)',
              '&:hover': {
                backgroundColor: darkMode ? 'rgba(63, 81, 181, 0.24)' : 'rgba(63, 81, 181, 0.12)',
              },
            },
          },
        },
      },
    },
  }), [darkMode]);
  
  // Fetch announcements on component mount
  useEffect(() => {
    if (isAuthenticated && user) {
      const fetchAnnouncements = async () => {
        try {
          const userAnnouncements = await getUserVisibleAnnouncements();
          setAnnouncements(userAnnouncements);
        } catch (error) {
          console.error('Error fetching announcements:', error);
        }
      };
      
      fetchAnnouncements();
    }
  }, [isAuthenticated, user, groups]);
  
  // Initialize call service
  useEffect(() => {
    if (isAuthenticated && user) {
      initializeCallService({
        username: user.username,
        onLocalStream: (stream) => setLocalStream(stream),
        onRemoteStream: (stream, participantId) => {
          setRemoteStreams(prev => [...prev, { stream, participantId }]);
        },
        onCallEnded: () => {
          setActiveCall(null);
          setRemoteStreams([]);
        }
      });
    }
  }, [isAuthenticated, user]);

  // Initialize WebSocket connection and peer discovery
  useEffect(() => {
    const handleOpen = () => {
      setConnected(true);
      setConnectionError(null);
      showNotification('Connected to server', 'success');
    };
    
    const handleClose = () => {
      setConnected(false);
      showNotification('Disconnected from server', 'error');
    };
    
    const handleError = (error) => {
      setConnected(false);
      setConnectionError(error.message);
      showNotification(`Connection error: ${error.message}`, 'error');
    };
    
    const handleMessage = (message) => {
      try {
        const data = JSON.parse(message);
        
        switch (data.type) {
          case 'peer_list':
            // Update peers with authorized status
            setPeers(data.peers.map(peer => ({
              ...peer,
              authorized: peer.authorized !== undefined ? peer.authorized : true // Default to true for backward compatibility
            })));
            break;
            
          case 'peer_joined':
            setPeers(prevPeers => {
              // Check if peer already exists
              if (prevPeers.some(p => p.id === data.peer.id)) {
                // Update existing peer if authorization status changed
                return prevPeers.map(p => 
                  p.id === data.peer.id 
                    ? { ...p, authorized: data.peer.authorized !== undefined ? data.peer.authorized : p.authorized } 
                    : p
                );
              }
              return [...prevPeers, {
                ...data.peer,
                authorized: data.peer.authorized !== undefined ? data.peer.authorized : true // Default to true for backward compatibility
              }];
            });
            showNotification(`${data.peer.hostname || data.peer.id} joined`, 'info');
            break;
            
          case 'peer_left':
            setPeers(prevPeers => prevPeers.filter(p => p.id !== data.peerId));
            if (selectedPeer && selectedPeer.id === data.peerId) {
              setSelectedPeer(null);
            }
            showNotification(`A peer has left the network`, 'info');
            break;

          case 'access_code_verification':
            if (data.success && pendingAuthPeerId) {
              setPeers(prevPeers => prevPeers.map(p => (
                p.id === pendingAuthPeerId ? { ...p, authorized: true } : p
              )));
              showNotification('Access code verified successfully', 'success');
            } else {
              showNotification(data.message || 'Invalid access code', 'warning');
            }
            setPendingAuthPeerId(null);
            break;
            
          case 'peer_auth_status':
            // Update peer authorization status
            setPeers(prevPeers => prevPeers.map(p => 
              p.id === data.peerId 
                ? { ...p, authorized: data.authorized } 
                : p
            ));
            
            // Show notification
            if (data.authorized) {
              showNotification(`${data.hostname || 'A peer'} is now authorized`, 'success');
            } else {
              showNotification(`${data.hostname || 'A peer'} is unauthorized`, 'warning');
            }
            break;
            
          case 'chat':
            handleChatMessage(data);
            break;
            
          case 'file_request':
            handleFileRequest(data);
            break;
            
          case 'file_chunk':
            handleFileChunk(data);
            break;
            
          case 'file_transfer_complete':
            handleFileTransferComplete(data);
            break;
            
          case 'clipboard':
            handleClipboardMessage(data);
            break;
            
          case 'group_chat':
            handleGroupChatMessage(data);
            break;
            
          case 'group_file_request':
            handleGroupFileRequest(data);
            break;
            
          case 'group_file_chunk':
            handleGroupFileChunk(data);
            break;
            
          case 'group_file_complete':
            handleGroupFileComplete(data);
            break;
            
          case 'GENERAL_ANNOUNCEMENT':
            handleGeneralAnnouncement(data);
            break;
            
          case 'GROUP_ANNOUNCEMENT':
            handleGroupAnnouncement(data);
            break;
            
          // Call-related message types
          case 'call_request':
            handleIncomingCallRequest(data);
            break;
            
          case 'call_accepted':
            handleCallAcceptedMessage(data);
            break;
            
          case 'call_rejected':
            handleCallRejectedMessage(data);
            break;
            
          case 'call_ended':
            handleCallEndedMessage(data);
            break;
            
          case 'ice_candidate':
            handleIceCandidateMessage(data);
            break;
            
          case 'sdp_offer':
          case 'sdp_answer':
            handleSdpMessage(data);
            break;
            
          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };
    
    // Initialize WebSocket connection
    initializeWebSocket({
      onOpen: handleOpen,
      onClose: handleClose,
      onError: handleError,
      onMessage: handleMessage
    });
    
    // Initialize peer discovery
    const unsubscribeDiscovery = onPeerDiscovered((peer, isNewPeer) => {
      if (isNewPeer) {
        // Automatically connect to newly discovered peers
        connectToPeer(peer).then(success => {
          if (success) {
            // Add to peers list
            setPeers(prevPeers => {
              // Check if peer already exists
              if (prevPeers.some(p => p.id === peer.id)) {
                return prevPeers;
              }
              return [...prevPeers, peer];
            });
            showNotification(`Connected to ${peer.hostname || peer.id}`, 'success');
          } else {
            showNotification(`Failed to connect to ${peer.hostname || peer.id}`, 'error');
          }
        });
      } else {
        // Update existing peer
        setPeers(prevPeers => {
          return prevPeers.map(p => p.id === peer.id ? peer : p);
        });
      }
    });
    
    // Clean up WebSocket connection and discovery on unmount
    return () => {
      closeWebSocket();
      unsubscribeDiscovery();
    };
  }, [selectedPeer]);
  
  // Handle chat messages
  const handleChatMessage = (data) => {
    const { from, content, timestamp } = data;
    
    setMessages(prevMessages => {
      const peerMessages = prevMessages[from] || [];
      return {
        ...prevMessages,
        [from]: [...peerMessages, { type: 'chat', from, content, timestamp }]
      };
    });
    
    // Show notification if message is from someone other than the selected peer
    if (!selectedPeer || selectedPeer.id !== from) {
      const peer = peers.find(p => p.id === from);
      const peerName = peer ? (peer.hostname || peer.id) : from;
      showNotification(`New message from ${peerName}`, 'info');
      
      // Show system notification if window is not focused
      if (document.hidden) {
        window.electron.showNotification({
          title: `Message from ${peerName}`,
          body: content
        });
      }
    }
  };
  
  // Handle file transfer requests
  const handleFileRequest = (data) => {
    const { transferId, fileName, fileSize, senderPeerId } = data;
    
    const peer = peers.find(p => p.id === senderPeerId);
    const peerName = peer ? (peer.hostname || peer.id) : senderPeerId;
    
    // Add to file transfers
    const transfer = {
      id: transferId,
      fileName,
      fileSize,
      progress: 0,
      status: 'receiving',
      peerId: senderPeerId,
      peerName,
      direction: 'download',
      timestamp: Date.now()
    };
    
    setFileTransfers(prev => [...prev, transfer]);
    
    // Add to history
    addFileTransferToHistory(transfer);
    
    // Show notification
    showNotification(`${peerName} is sending you a file: ${fileName}`, 'info');
  };
  
  // Handle file chunks
  const handleFileChunk = (data) => {
    const { transferId, chunkIndex, totalChunks } = data;
    
    // Update file transfer progress
    setFileTransfers(prev => {
      return prev.map(transfer => {
        if (transfer.id === transferId) {
          const progress = Math.floor((chunkIndex / totalChunks) * 100);
          const updatedTransfer = { ...transfer, progress };
          
          // Update history
          updateFileTransferInHistory(transferId, { progress });
          
          return updatedTransfer;
        }
        return transfer;
      });
    });
  };
  
  // Handle file transfer completion
  const handleFileTransferComplete = (data) => {
    const { transferId } = data;
    
    // Update file transfer status
    setFileTransfers(prev => {
      return prev.map(transfer => {
        if (transfer.id === transferId) {
          const updatedTransfer = { ...transfer, progress: 100, status: 'completed' };
          
          // Update history
          updateFileTransferInHistory(transferId, { progress: 100, status: 'completed' });
          
          return updatedTransfer;
        }
        return transfer;
      });
    });
    
    // Show notification
    showNotification('File transfer completed', 'success');
  };
  
  // Handle clipboard messages
  const handleClipboardMessage = (data) => {
    const { from, content } = data;
    
    // Copy to clipboard
    window.electron.setClipboardContent(content);
    
    // Show notification
    const peer = peers.find(p => p.id === from);
    const peerName = peer ? (peer.hostname || peer.id) : from;
    showNotification(`Received clipboard content from ${peerName}`, 'info');
  };
  
  // Handle group chat messages
  const handleGroupChatMessage = (data) => {
    const { groupId, senderId, content, timestamp } = data;
    
    setGroupMessages(prevMessages => {
      const groupMessages = prevMessages[groupId] || [];
      return {
        ...prevMessages,
        [groupId]: [...groupMessages, { type: 'group_chat', groupId, senderId, content, timestamp }]
      };
    });
    
    // Show notification if message is from a different group than selected
    if (!selectedGroup || selectedGroup.id !== groupId) {
      const group = groups.find(g => g.id === groupId);
      const groupName = group ? group.name : groupId;
      showNotification(`New message in ${groupName}`, 'info');
      
      // Show system notification if window is not focused
      if (document.hidden) {
        window.electron.showNotification({
          title: `Message in ${groupName}`,
          body: content
        });
      }
    }
  };
  
  // Handle general announcements
  const handleGeneralAnnouncement = (data) => {
    const { announcement } = data;
    
    // Add to announcements list
    setAnnouncements(prev => [announcement, ...prev]);
    
    // Show notification
    showNotification(`New general announcement: ${announcement.title}`, 'info');
    
    // Show system notification if window is not focused
    if (document.hidden) {
      window.electron.showNotification({
        title: 'New General Announcement',
        body: announcement.title
      });
    }
  };
  
  // Handle group announcements
  const handleGroupAnnouncement = (data) => {
    const { announcement, groupId } = data;
    
    // Add to announcements list
    setAnnouncements(prev => [{ ...announcement, groupId }, ...prev]);
    
    // Get group name
    const group = groups.find(g => g.id === groupId);
    const groupName = group ? group.name : groupId;
    
    // Show notification
    showNotification(`New announcement in ${groupName}: ${announcement.title}`, 'info');
    
    // Show system notification if window is not focused
    if (document.hidden) {
      window.electron.showNotification({
        title: `New Announcement in ${groupName}`,
        body: announcement.title
      });
    }
  };
  
  // Call-related handlers
  const handleIncomingCallRequest = (data) => {
    setIncomingCall(data);
    
    // Show notification
    const callerName = data.isGroupCall ? `Group: ${data.groupId}` : data.callerId;
    showNotification(`Incoming call from ${callerName}`, 'info');
  };
  
  const handleCallAcceptedMessage = (data) => {
    // Handle call accepted
    setActiveCall(data);
    setIncomingCall(null);
    showNotification('Call connected', 'success');
  };
  
  const handleCallRejectedMessage = (data) => {
    // Handle call rejected
    setActiveCall(null);
    showNotification('Call rejected', 'info');
  };
  
  const handleCallEndedMessage = (data) => {
    // Handle call ended
    setActiveCall(null);
    setRemoteStreams([]);
    showNotification('Call ended', 'info');
  };
  
  const handleIceCandidateMessage = (data) => {
    // Handle ICE candidate through handleCallMessage
    handleCallMessage(data);
  };
  
  const handleSdpMessage = (data) => {
    // Handle SDP exchange through handleCallMessage
    handleCallMessage(data);
  };
  
  // Call action handlers
  const startCall = (peerId) => {
    const callData = initiateCall(peerId);
    setActiveCall(callData);
  };
  
  const startGroupCall = (groupId) => {
    const callData = initiateGroupCall(groupId);
    setActiveCall(callData);
  };
  
  const handleAcceptIncomingCall = () => {
    acceptCall(incomingCall);
    setActiveCall(incomingCall);
    setIncomingCall(null);
  };
  
  const handleRejectIncomingCall = () => {
    rejectCall(incomingCall);
    setIncomingCall(null);
  };
  
  // Handle group file transfer requests
  const handleGroupFileRequest = (data) => {
    const { groupId, transferId, fileName, fileSize, senderId } = data;
    
    const group = groups.find(g => g.id === groupId);
    const groupName = group ? group.name : groupId;
    const peer = peers.find(p => p.id === senderId);
    const peerName = peer ? (peer.hostname || peer.id) : senderId;
    
    // Add to group file transfers
    const transfer = {
      id: transferId,
      fileName,
      fileSize,
      progress: 0,
      status: 'receiving',
      groupId,
      groupName,
      senderId,
      peerId: senderId,
      peerName,
      direction: 'download',
      timestamp: Date.now()
    };
    
    setGroupFileTransfers(prev => [...prev, transfer]);
    
    // Add to history
    addFileTransferToHistory(transfer);
    
    // Show notification
    showNotification(`File shared in ${groupName}: ${fileName}`, 'info');
  };
  
  // Handle group file chunks
  const handleGroupFileChunk = (data) => {
    const { groupId, transferId, chunkIndex, totalChunks } = data;
    
    // Update group file transfer progress
    setGroupFileTransfers(prev => {
      return prev.map(transfer => {
        if (transfer.id === transferId) {
          const progress = Math.floor((chunkIndex / totalChunks) * 100);
          const updatedTransfer = { ...transfer, progress };
          
          // Update history
          updateFileTransferInHistory(transferId, { progress });
          
          return updatedTransfer;
        }
        return transfer;
      });
    });
  };
  
  // Handle group file transfer completion
  const handleGroupFileComplete = (data) => {
    const { groupId, transferId } = data;
    
    // Update group file transfer status
    setGroupFileTransfers(prev => {
      return prev.map(transfer => {
        if (transfer.id === transferId) {
          const updatedTransfer = { ...transfer, progress: 100, status: 'completed' };
          
          // Update history
          updateFileTransferInHistory(transferId, { progress: 100, status: 'completed' });
          
          return updatedTransfer;
        }
        return transfer;
      });
    });
    
    // Show notification
    const group = groups.find(g => g.id === groupId);
    const groupName = group ? group.name : groupId;
    showNotification(`File transfer completed in ${groupName}`, 'success');
  };
  
  // Send a chat message
  const sendChatMessage = (content) => {
    if (!selectedPeer) return;
    
    const messageData = {
      type: 'chat',
      from: 'me',
      to: selectedPeer.id,
      content,
      timestamp: Date.now()
    };
    
    // Try to send via peer-to-peer connection first
    let messageSent = false;
    if (isConnectedToPeer(selectedPeer.id)) {
      messageSent = sendMessageToPeer(selectedPeer.id, messageData);
    }
    
    // Fallback to server relay if peer-to-peer fails
    if (!messageSent) {
      sendMessage(messageData);
    }
    
    // Add message to local state
    setMessages(prevMessages => {
      const peerMessages = prevMessages[selectedPeer.id] || [];
      return {
        ...prevMessages,
        [selectedPeer.id]: [
          ...peerMessages,
          { type: 'chat', senderId: 'me', content, timestamp: Date.now() }
        ]
      };
    });
  };
  
  // Send a file
  const sendFile = (filePath) => {
    if (!selectedPeer) return;
    
    // This would typically involve sending a file request to the backend
    // For now, we'll just show a notification
    showNotification(`Sending file to ${selectedPeer.hostname || selectedPeer.id}`, 'info');
  };
  
  // Send a group chat message
  const sendGroupChatMessage = (content) => {
    if (!selectedGroup) return;
    
    const messageData = {
      type: 'group_chat',
      groupId: selectedGroup.id,
      senderId: 'me',
      content,
      timestamp: Date.now()
    };
    
    // Send via WebSocket
    sendMessage(messageData);
    
    // Add message to local state
    setGroupMessages(prevMessages => {
      const groupMessages = prevMessages[selectedGroup.id] || [];
      return {
        ...prevMessages,
        [selectedGroup.id]: [
          ...groupMessages,
          { type: 'group_chat', groupId: selectedGroup.id, senderId: 'me', content, timestamp: Date.now() }
        ]
      };
    });
  };
  
  // Send a file to group
  const sendFileToGroup = async (file) => {
    if (!selectedGroup) return;
    
    try {
      const transferId = await sendFileToGroupService(file, selectedGroup.id, user.id, sendMessage);
      
      // Add to history
      const transfer = {
        id: transferId,
        fileName: file.name,
        fileSize: file.size,
        peerId: user.id,
        peerName: username,
        direction: 'upload',
        status: 'sending',
        progress: 0,
        timestamp: Date.now(),
        groupId: selectedGroup.id,
        groupName: selectedGroup.name
      };
      
      addFileTransferToHistory(transfer);
      
      showNotification(`Sending file to group ${selectedGroup.name}`, 'info');
    } catch (error) {
      console.error('Error sending file to group:', error);
      showNotification('Failed to send file to group', 'error');
    }
  };
  
  // Share clipboard content
  const shareClipboard = () => {
    if (!selectedPeer) return;
    
    // Get clipboard content
    window.electron.getClipboardContent();
    
    // Listen for clipboard content
    window.electron.on('clipboard-content', (content) => {
      const messageData = {
        type: 'clipboard',
        to: selectedPeer.id,
        content
      };
      
      // Send clipboard content via WebSocket
      sendMessage(messageData);
      
      showNotification(`Clipboard content shared with ${selectedPeer.hostname || selectedPeer.id}`, 'success');
    });
  };
  
  // Toggle theme mode
  const handleThemeToggle = (isDark) => {
    setDarkMode(isDark);
    // Save preference to localStorage
    localStorage.setItem('darkMode', isDark);
  };
  
  // Change username
  const handleUsernameChange = (newUsername) => {
    setUsername(newUsername);
    // Save username to localStorage
    localStorage.setItem('username', newUsername);
    showNotification(`Username changed to ${newUsername}`, 'success');
  };
  
  // Load user groups when user changes
  useEffect(() => {
    if (user && user.id) {
      loadUserGroups();
    }
  }, [user]);
  
  // Load user groups
  const loadUserGroups = async () => {
    if (!user || !user.id) return;
    
    try {
      const userGroups = await getUserGroups(user.id);
      setGroups(userGroups);
    } catch (error) {
      console.error('Error loading user groups:', error);
    }
  };
  
  // Handle group selection
  const handleGroupSelect = (group) => {
    setSelectedGroup(group);
    setSelectedPeer(null); // Clear peer selection when selecting group
  };
  
  // Handle group management dialog
  const handleManageGroups = () => {
    setGroupManagerOpen(true);
  };
  
  // Handle file transfer history dialog
  const handleOpenFileHistory = () => {
    setFileTransferHistoryOpen(true);
  };
  
  // Load saved preferences on initial load
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setDarkMode(savedDarkMode === 'true');
    }
    
    const savedUsername = localStorage.getItem('username');
    if (savedUsername) {
      setUsername(savedUsername);
    }
  }, []);
  
  /**
   * Display a notification to the user
   * 
   * This function handles two types of notifications:
   * 1. Toast notifications (temporary pop-ups)
   * 2. Persistent in-app notifications (in the notification panel)
   * 
   * Toast notifications are automatically dismissed after 5 seconds
   * 
   * @param {string} message - The notification message to display
   * @param {string} severity - The severity level (info, success, warning, error)
   */
  const showNotification = (message, severity = 'info') => {
    // Set the toast notification state
    setNotification({
      open: true, // Show the toast
      message,    // Message content
      severity    // Severity level for styling
    });
    
    // Auto-dismiss the toast notification after 5 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, open: false }));
    }, 5000);
    
    // Also add to the persistent in-app notifications panel
    addNotification({
      type: severity,   // Use severity as notification type
      message,         // Message content
      timestamp: Date.now() // Current timestamp
    });
  };
  
  /**
   * Add a notification to the persistent notifications list
   * 
   * This function creates a new notification object with a unique ID
   * and adds it to the beginning of the notifications array
   * 
   * @param {Object} notification - The notification object to add
   * @param {string} notification.type - The notification type (info, success, warning, error)
   * @param {string} notification.message - The notification message
   * @param {number} notification.timestamp - The notification creation time
   */
  const addNotification = (notification) => {
    // Create a new notification object with a unique ID
    const newNotification = {
      ...notification,
      id: Date.now().toString() // Generate unique ID from current timestamp
    };
    
    // Add the new notification to the beginning of the array
    setNotifications(prev => [newNotification, ...prev]);
  };
  
  /**
   * Remove a notification from the notifications list
   * 
   * This function filters out the notification with the specified ID
   * from the notifications array
   * 
   * @param {string} id - The unique ID of the notification to dismiss
   */
  const dismissNotification = (id) => {
    // Filter out the notification with the matching ID
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };
  
  /**
   * Close the toast notification
   * 
   * This function updates the notification state to hide the toast
   * without removing it from the state completely
   */
  const handleNotificationClose = () => {
    // Update only the 'open' property to false, preserving other properties
    setNotification(prev => ({ ...prev, open: false }));
  };
  
  // State for access code verification dialog
  const [accessCodeDialog, setAccessCodeDialog] = useState({
    open: false,
    peerId: null,
    peerName: '',
    accessCode: '',
    error: ''
  });

  // Handle login success
  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    setUsername(userData.username);
    showNotification(`Welcome, ${userData.username}!`, 'success');
  };
  
  // Handle peer selection
  const handlePeerSelect = (peer) => {
    // If peer is unauthorized, show access code dialog
    if (peer && !peer.authorized) {
      setAccessCodeDialog({
        open: true,
        peerId: peer.id,
        peerName: peer.hostname || 'Unknown peer',
        accessCode: '',
        error: ''
      });
      setPendingAuthPeerId(peer.id);
      return;
    }
    
    setSelectedPeer(peer);
    setSelectedGroup(null);
  };
  
  // Handle access code verification
  const handleVerifyAccessCode = () => {
    if (!accessCodeDialog.accessCode) {
      setAccessCodeDialog(prev => ({...prev, error: 'Access code is required'}));
      return;
    }
    
    // Send access code verification message
    sendMessage({
      type: 'verify_access_code',
      peerId: accessCodeDialog.peerId,
      accessCode: accessCodeDialog.accessCode
    });
    
    // Close dialog and reset
    setAccessCodeDialog({
      open: false,
      peerId: null,
      peerName: '',
      accessCode: '',
      error: ''
    });
    
    // Show notification
    setNotification({
      open: true,
      message: 'Verifying access code...',
      severity: 'info'
    });
  };
  
  // Handle logout
  const handleLogout = () => {
    logoutUser();
    setUser(null);
    setIsAuthenticated(false);
    setUsername('User');
    showNotification('You have been logged out', 'info');
  };
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {!isAuthenticated ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <Login onLoginSuccess={handleLoginSuccess} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          <Header 
            connected={connected} 
            shareClipboard={shareClipboard}
            selectedPeer={selectedPeer}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenFileHistory={handleOpenFileHistory}
            onOpenBulletinBoard={() => setBulletinBoardOpen(true)}
            user={user}
            onLogout={handleLogout}
            onVoiceCall={() => selectedPeer && startCall(selectedPeer.id)}
            onVideoCall={() => selectedPeer && startCall(selectedPeer.id, true)}
          />
          
          <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
            <Sidebar 
              peers={peers} 
              selectedPeer={selectedPeer} 
              onSelectPeer={setSelectedPeer}
              fileTransfers={fileTransfers}
              groups={groups}
              selectedGroup={selectedGroup}
              onSelectGroup={handleGroupSelect}
              onManageGroups={handleManageGroups}
              onCallPeer={startCall}
              onCallGroup={startGroupCall}
            />
            
            {selectedGroup ? (
              <GroupChat 
                messages={selectedGroup ? (groupMessages[selectedGroup.id] || []) : []}
                selectedGroup={selectedGroup}
                onSendMessage={sendGroupChatMessage}
                onSendFile={sendFileToGroup}
                connected={connected}
                username={username}
                groupMembers={selectedGroup ? selectedGroup.members.map(memberId => {
                  const peer = peers.find(p => p.id === memberId);
                  return peer || { id: memberId, name: memberId };
                }) : []}
              />
            ) : (
              <ChatArea 
                messages={selectedPeer ? (messages[selectedPeer.id] || []) : []}
                selectedPeer={selectedPeer}
                onSendMessage={sendChatMessage}
                onSendFile={sendFile}
                connected={connected}
                username={username}
              />
            )}
          </Box>
          
          <ConnectionStatus 
            connected={connected} 
            error={connectionError} 
          />
          
          <Snackbar 
            open={notification.open} 
            autoHideDuration={6000} 
            onClose={handleNotificationClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <Alert 
              onClose={handleNotificationClose} 
              severity={notification.severity} 
              sx={{ width: '100%' }}
            >
              {notification.message}
            </Alert>
          </Snackbar>
          
          {/* Notification manager */}
          <NotificationManager 
            notifications={notifications} 
            onDismiss={dismissNotification} 
          />
          
          {/* Access Code Verification Dialog */}
          <Dialog open={accessCodeDialog.open} onClose={() => setAccessCodeDialog(prev => ({ ...prev, open: false }))}>
            <DialogTitle>
              Unauthorized Peer
              <IconButton
                aria-label="close"
                onClick={() => setAccessCodeDialog(prev => ({ ...prev, open: false }))}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ p: 2 }}>
                <Typography variant="body1" gutterBottom>
                  {accessCodeDialog.peerName} is not authorized to communicate with you.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  To authorize this peer, enter your access code below:
                </Typography>
                <TextField
                  autoFocus
                  margin="dense"
                  label="Access Code"
                  type="password"
                  fullWidth
                  variant="outlined"
                  value={accessCodeDialog.accessCode}
                  onChange={(e) => setAccessCodeDialog(prev => ({ ...prev, accessCode: e.target.value }))}
                  error={!!accessCodeDialog.error}
                  helperText={accessCodeDialog.error}
                  sx={{ mb: 2 }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                  <Button 
                    onClick={() => setAccessCodeDialog(prev => ({ ...prev, open: false }))}
                    sx={{ mr: 1 }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="contained" 
                    onClick={handleVerifyAccessCode}
                  >
                    Verify
                  </Button>
                </Box>
              </Box>
            </DialogContent>
          </Dialog>
          
          {/* Bulletin Board Notifications */}
          <Box 
            sx={{ 
              position: 'fixed',
              top: 80,
              right: 16,
              width: 350,
              maxHeight: '30vh',
              overflow: 'auto',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {announcements.slice(0, 3).map((announcement) => (
              <BulletinNotification
                key={announcement.id}
                announcement={announcement}
                onClose={() => setAnnouncements(prev => prev.filter(a => a.id !== announcement.id))}
                onClick={() => setBulletinBoardOpen(true)}
              />
            ))}
          </Box>
          
          {/* Settings dialog */}
          <Settings
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            username={username}
            onUsernameChange={handleUsernameChange}
            darkMode={darkMode}
            onThemeToggle={handleThemeToggle}
            user={user}
          />
          
          {/* Group manager dialog */}
          <GroupManager
            open={groupManagerOpen}
            onClose={() => setGroupManagerOpen(false)}
            userId={user ? user.id : null}
            availablePeers={peers}
            onGroupSelect={handleGroupSelect}
            selectedGroup={selectedGroup}
            onGroupsUpdated={loadUserGroups}
          />
          
          {/* File transfer history dialog */}
          <FileTransferHistory 
            open={fileTransferHistoryOpen} 
            onClose={() => setFileTransferHistoryOpen(false)} 
          />
          
          {/* Bulletin Board Dialog */}
          {bulletinBoardOpen && (
            <Dialog
              open={bulletinBoardOpen}
              onClose={() => setBulletinBoardOpen(false)}
              maxWidth="md"
              fullWidth
            >
              <DialogTitle>
                Bulletin Board
                <IconButton
                  aria-label="close"
                  onClick={() => setBulletinBoardOpen(false)}
                  sx={{ position: 'absolute', right: 8, top: 8 }}
                >
                  <CloseIcon />
                </IconButton>
              </DialogTitle>
              <DialogContent dividers>
                <BulletinBoard 
                  userId={user?.id} 
                  userGroups={groups} 
                  selectedGroup={selectedGroup} 
                />
              </DialogContent>
            </Dialog>
          )}
        
          {/* Call interface */}
          {activeCall && (
            <CallInterface
              call={activeCall}
              localStream={localStream}
              remoteStreams={remoteStreams}
              onClose={() => setActiveCall(null)}
            />
          )}
          
          {/* Incoming call notification */}
          <CallNotification
            open={incomingCall !== null}
            callData={incomingCall}
            onAccept={handleAcceptIncomingCall}
            onReject={handleRejectIncomingCall}
          />
        </Box>
      )}
    </ThemeProvider>
  );
}

export default App;
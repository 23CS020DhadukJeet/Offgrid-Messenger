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

// Import NotificationManager
import NotificationManager from './components/NotificationManager';

// Import components
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import ConnectionStatus from './components/ConnectionStatus';
import Settings from './components/Settings';
import Login from './components/Login';

// Import auth service
import { isLoggedIn, getCurrentUser, logoutUser } from './services/authService';

// Import WebSocket service
import { initializeWebSocket, sendMessage, closeWebSocket } from './services/websocketService';

function App() {
  // State for user authentication
  const [isAuthenticated, setIsAuthenticated] = useState(isLoggedIn());
  const [user, setUser] = useState(getCurrentUser());
  
  // State for managing peers
  const [peers, setPeers] = useState([]);
  const [selectedPeer, setSelectedPeer] = useState(null);
  
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
  
  // State for theme mode
  const [darkMode, setDarkMode] = useState(false);
  
  // State for username
  const [username, setUsername] = useState(user ? user.username : 'User');
  
  // Create theme based on mode
  const theme = useMemo(() => createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#1976d2',
      },
      secondary: {
        main: '#dc004e',
      },
      background: {
        default: darkMode ? '#303030' : '#f5f5f5',
        paper: darkMode ? '#424242' : '#ffffff',
      },
    },
  }), [darkMode]);
  
  // Initialize WebSocket connection
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
            setPeers(data.peers);
            break;
            
          case 'peer_joined':
            setPeers(prevPeers => {
              // Check if peer already exists
              if (prevPeers.some(p => p.id === data.peer.id)) {
                return prevPeers;
              }
              return [...prevPeers, data.peer];
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
    
    // Clean up WebSocket connection on unmount
    return () => {
      closeWebSocket();
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
    
    // Add to file transfers
    setFileTransfers(prev => [
      ...prev,
      {
        id: transferId,
        fileName,
        fileSize,
        progress: 0,
        status: 'receiving',
        peerId: senderPeerId
      }
    ]);
    
    // Show notification
    const peer = peers.find(p => p.id === senderPeerId);
    const peerName = peer ? (peer.hostname || peer.id) : senderPeerId;
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
          return { ...transfer, progress };
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
          return { ...transfer, progress: 100, status: 'completed' };
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
  
  // Send a chat message
  const sendChatMessage = (content) => {
    if (!selectedPeer) return;
    
    const messageData = {
      type: 'chat',
      to: selectedPeer.id,
      content,
      timestamp: Date.now()
    };
    
    // Send message via WebSocket
    sendMessage(messageData);
    
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
  
  // Handle login success
  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    setUsername(userData.username);
    showNotification(`Welcome, ${userData.username}!`, 'success');
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
            user={user}
            onLogout={handleLogout}
          />
          
          <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
            <Sidebar 
              peers={peers} 
              selectedPeer={selectedPeer} 
              onSelectPeer={setSelectedPeer}
              fileTransfers={fileTransfers}
            />
            
            <ChatArea 
              messages={selectedPeer ? (messages[selectedPeer.id] || []) : []}
              selectedPeer={selectedPeer}
              onSendMessage={sendChatMessage}
              onSendFile={sendFile}
              connected={connected}
              username={username}
            />
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
        </Box>
      )}
    </ThemeProvider>
  );
}

export default App;
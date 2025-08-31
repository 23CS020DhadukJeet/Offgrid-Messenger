/**
 * HomePage.js - Main page component for the application
 * 
 * This component serves as the main page of the application, integrating
 * all the UI components and managing the application state.
 */

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

// Import components
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import ConnectionStatus from '../components/ConnectionStatus';
import NotificationItem from '../components/NotificationItem';

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#9c27b0',
    },
  },
});

function HomePage() {
  // State for WebSocket connection
  const [connected, setConnected] = useState(false);
  const [localInfo, setLocalInfo] = useState(null);
  
  // State for peers and messages
  const [peers, setPeers] = useState([]);
  const [selectedPeer, setSelectedPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  
  // State for file transfers
  const [fileTransfers, setFileTransfers] = useState([]);
  
  // State for notifications
  const [notifications, setNotifications] = useState([]);
  
  // State for alerts
  const [alert, setAlert] = useState({ open: false, message: '', severity: 'info' });

  // Initialize WebSocket connection and event listeners
  useEffect(() => {
    // Initialize connection to backend via IPC
    if (window.electron) {
      // Listen for connection status changes
      window.electron.onConnectionStatus((status, info) => {
        setConnected(status);
        if (info) setLocalInfo(info);
      });
      
      // Listen for peer updates
      window.electron.onPeerUpdate((peerList) => {
        setPeers(peerList);
        // If selected peer is no longer in the list, deselect it
        if (selectedPeer && !peerList.find(p => p.id === selectedPeer.id)) {
          setSelectedPeer(null);
        }
      });
      
      // Listen for new messages
      window.electron.onMessage((message) => {
        setMessages(prev => [...prev, message]);
        
        // Create notification for new message if not from selected peer
        if (!selectedPeer || message.senderId !== selectedPeer.id) {
          const sender = peers.find(p => p.id === message.senderId);
          addNotification({
            type: 'message',
            title: `New message from ${sender ? sender.hostname : 'Unknown'}`,
            message: message.content.substring(0, 30) + (message.content.length > 30 ? '...' : ''),
            timestamp: message.timestamp
          });
        }
      });
      
      // Listen for file transfer updates
      window.electron.onFileTransfer((transfer) => {
        setFileTransfers(prev => {
          const existing = prev.findIndex(t => t.id === transfer.id);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = transfer;
            return updated;
          } else {
            return [...prev, transfer];
          }
        });
        
        // Create notification for completed transfers
        if (transfer.status === 'completed') {
          addNotification({
            type: 'file',
            title: transfer.direction === 'upload' ? 'File sent successfully' : 'File received',
            message: `${transfer.fileName} ${transfer.direction === 'upload' ? 'sent to' : 'received from'} ${transfer.peerName}`,
            timestamp: Date.now()
          });
        }
      });
      
      // Listen for clipboard updates
      window.electron.onClipboard((data) => {
        const sender = peers.find(p => p.id === data.senderId);
        addNotification({
          type: 'clipboard',
          title: `Clipboard received from ${sender ? sender.hostname : 'Unknown'}`,
          message: data.content.substring(0, 30) + (data.content.length > 30 ? '...' : ''),
          timestamp: Date.now()
        });
      });
    }
    
    return () => {
      // Clean up event listeners
      if (window.electron) {
        window.electron.removeAllListeners();
      }
    };
  }, [peers, selectedPeer]);

  // Function to send a message
  const sendMessage = (content) => {
    if (!selectedPeer || !content.trim()) return;
    
    const message = {
      senderId: 'me',
      receiverId: selectedPeer.id,
      content,
      timestamp: Date.now()
    };
    
    // Add message to local state
    setMessages(prev => [...prev, message]);
    
    // Send message via IPC
    if (window.electron) {
      window.electron.sendMessage({
        peerId: selectedPeer.id,
        content
      });
    }
  };

  // Function to send a file
  const sendFile = (file) => {
    if (!selectedPeer || !file) return;
    
    // Send file via IPC
    if (window.electron) {
      window.electron.sendFile({
        peerId: selectedPeer.id,
        filePath: file.path
      });
      
      setAlert({
        open: true,
        message: `Sending ${file.name} to ${selectedPeer.hostname}...`,
        severity: 'info'
      });
    }
  };

  // Function to share clipboard content
  const shareClipboard = () => {
    if (!selectedPeer) return;
    
    // Get and share clipboard via IPC
    if (window.electron) {
      window.electron.getClipboard().then(content => {
        if (content) {
          window.electron.shareClipboard({
            peerId: selectedPeer.id,
            content
          });
          
          setAlert({
            open: true,
            message: `Clipboard shared with ${selectedPeer.hostname}`,
            severity: 'success'
          });
        }
      });
    }
  };

  // Function to add a notification
  const addNotification = (notification) => {
    const newNotification = {
      ...notification,
      id: Date.now().toString(),
      read: false
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    
    // Show system notification if supported
    if (window.electron) {
      window.electron.showNotification({
        title: notification.title,
        body: notification.message
      });
    }
  };

  // Function to dismiss a notification
  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Function to handle alert close
  const handleAlertClose = () => {
    setAlert({ ...alert, open: false });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100vh',
        overflow: 'hidden'
      }}>
        <Header 
          connected={connected} 
          shareClipboard={shareClipboard}
          selectedPeer={selectedPeer}
        />
        
        <ConnectionStatus connected={connected} localInfo={localInfo} />
        
        <Box sx={{ 
          display: 'flex', 
          flexGrow: 1,
          overflow: 'hidden'
        }}>
          <Sidebar 
            peers={peers} 
            selectedPeer={selectedPeer} 
            onSelectPeer={setSelectedPeer}
            fileTransfers={fileTransfers}
          />
          
          <ChatArea 
            messages={messages} 
            selectedPeer={selectedPeer}
            sendMessage={sendMessage}
            sendFile={sendFile}
          />
        </Box>
        
        {/* Notifications panel */}
        {notifications.length > 0 && (
          <Box 
            sx={{ 
              position: 'absolute', 
              bottom: 16, 
              right: 16, 
              width: 320,
              maxHeight: 400,
              overflow: 'auto',
              zIndex: 1000
            }}
          >
            {notifications.map(notification => (
              <NotificationItem 
                key={notification.id}
                notification={notification}
                onClose={dismissNotification}
              />
            ))}
          </Box>
        )}
        
        {/* Alert snackbar */}
        <Snackbar 
          open={alert.open} 
          autoHideDuration={6000} 
          onClose={handleAlertClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Alert 
            onClose={handleAlertClose} 
            severity={alert.severity} 
            sx={{ width: '100%' }}
          >
            {alert.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

export default HomePage;
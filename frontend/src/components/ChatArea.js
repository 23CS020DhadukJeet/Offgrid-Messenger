/**
 * ChatArea.js - Component for displaying chat messages and input area
 * 
 * This component handles the display of chat messages between peers and
 * provides an input area for sending new messages and files.
 */

import React, { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { styled } from '@mui/material/styles';

// Styled component for message bubbles
const MessageBubble = styled(Paper)(({ theme, ismine }) => ({
  padding: theme.spacing(1, 2),
  marginBottom: theme.spacing(1),
  maxWidth: '70%',
  wordBreak: 'break-word',
  backgroundColor: ismine === 'true' ? theme.palette.primary.light : theme.palette.grey[100],
  color: ismine === 'true' ? theme.palette.primary.contrastText : theme.palette.text.primary,
  alignSelf: ismine === 'true' ? 'flex-end' : 'flex-start',
  borderRadius: ismine === 'true' 
    ? theme.spacing(2, 2, 0, 2)
    : theme.spacing(2, 2, 2, 0),
}));

function ChatArea({ messages, selectedPeer, onSendMessage, onSendFile }) {
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageText.trim() && selectedPeer) {
      onSendMessage(messageText);
      setMessageText('');
    }
  };
  
  const handleFileSelect = () => {
    fileInputRef.current.click();
  };
  
  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files.length > 0 && selectedPeer) {
      onSendFile(files[0]);
      // Reset file input
      e.target.value = null;
    }
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      flexGrow: 1,
    }}>
      {/* Messages area */}
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {selectedPeer ? (
          // Show messages when a peer is selected
          <>
            {messages.filter(msg => 
              msg.senderId === selectedPeer.id || msg.receiverId === selectedPeer.id
            ).map((message, index) => (
              <MessageBubble 
                key={index} 
                ismine={message.senderId === 'me' ? 'true' : 'false'}
                elevation={1}
              >
                <Typography variant="body1">{message.content}</Typography>
                <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </Typography>
              </MessageBubble>
            ))}
          </>
        ) : (
          // Show message when no peer is selected
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <Typography variant="h6" color="text.secondary">
              Select a peer to start messaging
            </Typography>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>
      
      <Divider />
      
      {/* Message input area - always visible but disabled when no peer is selected */}
      <Box sx={{ p: 2, backgroundColor: 'background.paper' }}>
        <form onSubmit={handleSendMessage}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TextField
              fullWidth
              placeholder={selectedPeer ? "Type a message" : "Select a peer to chat"}
              variant="outlined"
              size="small"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage(e)}
              sx={{ mr: 1 }}
              disabled={!selectedPeer}
            />
            
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            
            <Tooltip title={selectedPeer ? "Attach File" : "Select a peer to attach files"}>
              <span>
                <IconButton 
                  onClick={handleFileSelect} 
                  color="primary"
                  disabled={!selectedPeer}
                >
                  <AttachFileIcon />
                </IconButton>
              </span>
            </Tooltip>
            
            <Tooltip title={selectedPeer ? "Send Message" : "Select a peer to send messages"}>
              <span>
                <IconButton 
                  type="submit" 
                  color="primary" 
                  disabled={!messageText.trim() || !selectedPeer}
                >
                  <SendIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </form>
      </Box>
    </Box>
  );
}

export default ChatArea;
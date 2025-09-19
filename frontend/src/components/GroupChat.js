/**
 * GroupChat.js - Component for displaying group chat messages and input area
 * 
 * This component handles the display of group chat messages and provides
 * an input area for sending new messages and files to the group.
 */

import React, { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import GroupIcon from '@mui/icons-material/Group';
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

// Styled component for group header
const GroupHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2)
}));

function GroupChat({ 
  messages, 
  selectedGroup, 
  onSendMessage, 
  onSendFile, 
  connected, 
  username,
  groupMembers = []
}) {
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
    if (messageText.trim() && selectedGroup) {
      onSendMessage(messageText);
      setMessageText('');
    }
  };
  
  const handleFileSelect = () => {
    fileInputRef.current.click();
  };
  
  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files.length > 0 && selectedGroup) {
      onSendFile(files[0]);
      // Reset file input
      e.target.value = null;
    }
  };

  const getMemberName = (memberId) => {
    if (memberId === 'me') return username;
    // Try to find member in group members list
    const member = groupMembers.find(m => m.id === memberId);
    return member ? member.name || member.hostname || memberId : memberId;
  };

  const getMemberInitials = (memberId) => {
    const name = getMemberName(memberId);
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      flexGrow: 1,
    }}>
      {/* Group header */}
      {selectedGroup && (
        <GroupHeader>
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            <GroupIcon />
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="div">
              {selectedGroup.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {groupMembers.length} member{groupMembers.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {groupMembers.slice(0, 5).map((member) => (
              <Chip
                key={member.id}
                label={member.name || member.hostname || member.id}
                size="small"
                variant="outlined"
              />
            ))}
            {groupMembers.length > 5 && (
              <Chip
                label={`+${groupMembers.length - 5} more`}
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        </GroupHeader>
      )}
      
      {/* Messages area */}
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {selectedGroup ? (
          // Show messages when a group is selected
          <>
            {messages.map((message, index) => (
              <Box key={index} sx={{ display: 'flex', flexDirection: 'column', mb: 1 }}>
                <MessageBubble 
                  ismine={message.senderId === 'me' ? 'true' : 'false'}
                  elevation={1}
                >
                  {message.senderId !== 'me' && (
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold' }}>
                      {getMemberName(message.senderId)}
                    </Typography>
                  )}
                  <Typography variant="body1">{message.content}</Typography>
                  <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </Typography>
                </MessageBubble>
              </Box>
            ))}
          </>
        ) : (
          // Show message when no group is selected
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <Typography variant="h6" color="text.secondary">
              Select a group to start messaging
            </Typography>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>
      
      <Divider />
      
      {/* Message input area - always visible but disabled when no group is selected */}
      <Box sx={{ p: 2, backgroundColor: 'background.paper' }}>
        <form onSubmit={handleSendMessage}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TextField
              fullWidth
              placeholder={selectedGroup ? "Type a message to the group" : "Select a group to chat"}
              variant="outlined"
              size="small"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage(e)}
              sx={{ mr: 1 }}
              disabled={!selectedGroup}
            />
            
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            
            <Tooltip title={selectedGroup ? "Attach File" : "Select a group to attach files"}>
              <span>
                <IconButton 
                  onClick={handleFileSelect} 
                  color="primary"
                  disabled={!selectedGroup}
                >
                  <AttachFileIcon />
                </IconButton>
              </span>
            </Tooltip>
            
            <Tooltip title={selectedGroup ? "Send Message" : "Select a group to send messages"}>
              <span>
                <IconButton 
                  type="submit" 
                  color="primary" 
                  disabled={!messageText.trim() || !selectedGroup}
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

export default GroupChat;

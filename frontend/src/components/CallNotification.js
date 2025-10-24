/**
 * CallNotification.js - Component for incoming call notifications
 * 
 * This component displays a notification for incoming calls with options
 * to accept or reject the call.
 */

import React from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  Box, 
  Avatar,
  IconButton
} from '@mui/material';
import {
  Call as CallIcon,
  CallEnd as CallEndIcon
} from '@mui/icons-material';
import { acceptCall, rejectCall } from '../services/callService';

const CallNotification = ({ 
  open, 
  callData, 
  onAccept, 
  onReject 
}) => {
  if (!callData) return null;
  
  const { callerId, isGroupCall, groupId } = callData;
  
  const handleAccept = () => {
    acceptCall(callData);
    if (onAccept) onAccept();
  };
  
  const handleReject = () => {
    rejectCall(callData);
    if (onReject) onReject();
  };
  
  return (
    <Dialog 
      open={open} 
      onClose={handleReject}
      PaperProps={{
        sx: {
          borderRadius: 2,
          minWidth: 300
        }
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
        {isGroupCall ? 'Incoming Group Call' : 'Incoming Call'}
      </DialogTitle>
      
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
        <Avatar 
          sx={{ 
            width: 80, 
            height: 80, 
            mb: 2,
            bgcolor: 'primary.main'
          }}
        >
          {(isGroupCall ? groupId : callerId).charAt(0).toUpperCase()}
        </Avatar>
        
        <Typography variant="h6" sx={{ mb: 1 }}>
          {isGroupCall ? `Group: ${groupId}` : callerId}
        </Typography>
        
        <Typography variant="body2" color="text.secondary">
          {isGroupCall ? 'is inviting you to join a group call' : 'is calling you'}
        </Typography>
      </DialogContent>
      
      <DialogActions sx={{ justifyContent: 'center', pb: 3, px: 2 }}>
        <Box sx={{ display: 'flex', gap: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <IconButton 
              onClick={handleReject}
              sx={{ 
                bgcolor: 'error.main', 
                color: 'white', 
                '&:hover': { bgcolor: 'error.dark' },
                mb: 1
              }}
            >
              <CallEndIcon />
            </IconButton>
            <Typography variant="body2">Decline</Typography>
          </Box>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <IconButton 
              onClick={handleAccept}
              sx={{ 
                bgcolor: 'success.main', 
                color: 'white', 
                '&:hover': { bgcolor: 'success.dark' },
                mb: 1
              }}
            >
              <CallIcon />
            </IconButton>
            <Typography variant="body2">Accept</Typography>
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default CallNotification;
/**
 * CallInterface.js - Component for voice and video call interface
 * 
 * This component provides the UI for both individual and group calls,
 * including video display, call controls, and participant management.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  IconButton, 
  Typography, 
  Paper, 
  Grid,
  Avatar,
  Tooltip,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button
} from '@mui/material';
import {
  Call as CallIcon,
  CallEnd as CallEndIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Videocam as VideocamIcon,
  VideocamOff as VideocamOffIcon,
  ScreenShare as ScreenShareIcon,
  StopScreenShare as StopScreenShareIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import { 
  toggleAudioMute, 
  toggleVideo, 
  endCall, 
  leaveGroupCall, 
  endGroupCall,
  getLocalStream
} from '../services/callService';

const CallInterface = ({ 
  call, 
  localStream, 
  remoteStreams, 
  onClose 
}) => {
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoDisabled, setVideoDisabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  
  const localVideoRef = useRef(null);
  
  // Set up local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);
  
  // Handle call end
  const handleEndCall = () => {
    if (call.isGroupCall) {
      if (call.isInitiator) {
        endGroupCall();
      } else {
        leaveGroupCall();
      }
    } else {
      endCall();
    }
    
    if (onClose) {
      onClose();
    }
  };
  
  // Toggle audio mute
  const handleToggleAudio = () => {
    const newMuteState = toggleAudioMute();
    setAudioMuted(newMuteState);
  };
  
  // Toggle video
  const handleToggleVideo = () => {
    const newVideoState = toggleVideo();
    setVideoDisabled(!newVideoState);
  };
  
  // Toggle screen sharing
  const handleToggleScreenShare = async () => {
    if (screenSharing) {
      // Stop screen sharing and revert to camera
      const stream = getLocalStream();
      if (stream) {
        stream.getTracks().forEach(track => {
          if (track.kind === 'video') {
            track.stop();
          }
        });
      }
      
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newStream;
        }
        setScreenSharing(false);
      } catch (error) {
        console.error('Error reverting to camera:', error);
      }
    } else {
      // Start screen sharing
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        setScreenSharing(true);
        
        // Handle the case when user stops sharing via the browser UI
        screenStream.getVideoTracks()[0].onended = () => {
          setScreenSharing(false);
          handleToggleScreenShare();
        };
      } catch (error) {
        console.error('Error sharing screen:', error);
      }
    }
  };
  
  // Toggle participants dialog
  const handleToggleParticipants = () => {
    setShowParticipants(!showParticipants);
  };
  
  // Render remote video streams for group calls
  const renderRemoteStreams = () => {
    if (!remoteStreams || remoteStreams.length === 0) {
      return (
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            height: '100%',
            width: '100%'
          }}
        >
          <Typography variant="body1" color="text.secondary">
            Waiting for others to join...
          </Typography>
        </Box>
      );
    }
    
    return (
      <Grid container spacing={2} sx={{ height: '100%' }}>
        {remoteStreams.map((stream, index) => (
          <Grid item xs={12} sm={6} md={4} key={index} sx={{ height: '33%' }}>
            <RemoteVideoView stream={stream.stream} participantId={stream.participantId} />
          </Grid>
        ))}
      </Grid>
    );
  };
  
  return (
    <Box sx={{ 
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      bgcolor: 'background.default',
      zIndex: 1300,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Call header */}
      <Box sx={{ 
        p: 2, 
        borderBottom: '1px solid', 
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography variant="h6">
          {call.isGroupCall ? 'Group Call' : 'Call with ' + (call.calleeId || call.callerId)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {formatCallDuration(call.startTime)}
        </Typography>
      </Box>
      
      {/* Call content */}
      <Box sx={{ 
        flex: 1,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        overflow: 'hidden'
      }}>
        {/* Local video */}
        <Box sx={{ 
          width: { xs: '100%', md: '25%' },
          height: { xs: '30%', md: '100%' },
          p: 1,
          position: 'relative'
        }}>
          <Paper 
            elevation={3} 
            sx={{ 
              height: '100%', 
              overflow: 'hidden',
              position: 'relative',
              bgcolor: 'black'
            }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)' // Mirror effect
              }}
            />
            {videoDisabled && (
              <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                bgcolor: 'rgba(0, 0, 0, 0.7)'
              }}>
                <Avatar sx={{ width: 80, height: 80 }}>
                  {(call.calleeId || call.callerId || 'User').charAt(0).toUpperCase()}
                </Avatar>
              </Box>
            )}
            <Box sx={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              px: 1,
              borderRadius: 1
            }}>
              <Typography variant="body2">You</Typography>
            </Box>
          </Paper>
        </Box>
        
        {/* Remote videos */}
        <Box sx={{ 
          flex: 1,
          p: 1,
          overflow: 'auto'
        }}>
          {renderRemoteStreams()}
        </Box>
      </Box>
      
      {/* Call controls */}
      <Box sx={{ 
        p: 2, 
        borderTop: '1px solid', 
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'center',
        gap: 2
      }}>
        <Tooltip title={audioMuted ? "Unmute" : "Mute"}>
          <IconButton 
            onClick={handleToggleAudio}
            color={audioMuted ? "default" : "primary"}
            sx={{ bgcolor: 'action.hover' }}
          >
            {audioMuted ? <MicOffIcon /> : <MicIcon />}
          </IconButton>
        </Tooltip>
        
        <Tooltip title={videoDisabled ? "Enable Video" : "Disable Video"}>
          <IconButton 
            onClick={handleToggleVideo}
            color={videoDisabled ? "default" : "primary"}
            sx={{ bgcolor: 'action.hover' }}
          >
            {videoDisabled ? <VideocamOffIcon /> : <VideocamIcon />}
          </IconButton>
        </Tooltip>
        
        <Tooltip title={screenSharing ? "Stop Sharing" : "Share Screen"}>
          <IconButton 
            onClick={handleToggleScreenShare}
            color={screenSharing ? "secondary" : "default"}
            sx={{ bgcolor: 'action.hover' }}
          >
            {screenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
          </IconButton>
        </Tooltip>
        
        {call.isGroupCall && (
          <Tooltip title="Participants">
            <IconButton 
              onClick={handleToggleParticipants}
              color="default"
              sx={{ bgcolor: 'action.hover' }}
            >
              <PeopleIcon />
            </IconButton>
          </Tooltip>
        )}
        
        <Tooltip title="End Call">
          <IconButton 
            onClick={handleEndCall}
            color="error"
            sx={{ bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' } }}
          >
            <CallEndIcon />
          </IconButton>
        </Tooltip>
      </Box>
      
      {/* Participants dialog */}
      {call.isGroupCall && (
        <Dialog open={showParticipants} onClose={handleToggleParticipants}>
          <DialogTitle>Call Participants</DialogTitle>
          <DialogContent>
            {call.participants && call.participants.map((participant, index) => (
              <Box key={index} sx={{ py: 1, display: 'flex', alignItems: 'center' }}>
                <Avatar sx={{ mr: 2 }}>{participant.charAt(0).toUpperCase()}</Avatar>
                <Typography>{participant}</Typography>
                {participant === call.initiatorId && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    (Host)
                  </Typography>
                )}
              </Box>
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleToggleParticipants}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

// Component for displaying remote video
const RemoteVideoView = ({ stream, participantId }) => {
  const videoRef = useRef(null);
  
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        height: '100%', 
        overflow: 'hidden',
        position: 'relative',
        bgcolor: 'black'
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
      />
      <Box sx={{
        position: 'absolute',
        bottom: 8,
        left: 8,
        bgcolor: 'rgba(0, 0, 0, 0.5)',
        color: 'white',
        px: 1,
        borderRadius: 1
      }}>
        <Typography variant="body2">{participantId}</Typography>
      </Box>
    </Paper>
  );
};

// Helper function to format call duration
const formatCallDuration = (startTime) => {
  const duration = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default CallInterface;
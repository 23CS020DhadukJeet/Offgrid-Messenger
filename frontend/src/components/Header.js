/**
 * Header.js - Application header component
 * 
 * This component displays the application header with title, connection status,
 * and action buttons for clipboard sharing and settings.
 */

import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SettingsIcon from '@mui/icons-material/Settings';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import NotificationsIcon from '@mui/icons-material/Notifications';
import HistoryIcon from '@mui/icons-material/History';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AnnouncementIcon from '@mui/icons-material/Announcement';
import CallIcon from '@mui/icons-material/Call';
import VideocamIcon from '@mui/icons-material/Videocam';

function Header({ connected, shareClipboard, selectedPeer, onOpenSettings, onOpenFileHistory, onOpenBulletinBoard, user, onLogout, onVoiceCall, onVideoCall }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleClose = () => {
    setAnchorEl(null);
  };
  
  const handleLogout = () => {
    handleClose();
    if (onLogout) onLogout();
  };
  
  return (
    <AppBar position="static" elevation={3} sx={{ 
      background: 'linear-gradient(90deg, #1976d2 0%, #2196f3 100%)'
    }}>
      <Toolbar sx={{ 
        display: 'flex', 
        flexWrap: 'nowrap',
        justifyContent: 'space-between',
        px: { xs: 1, sm: 2 }
      }}>
        <Typography 
          variant={isMobile ? "subtitle1" : "h6"} 
          component="div" 
          sx={{ 
            flexGrow: 1,
            fontWeight: 'bold',
            letterSpacing: '0.5px'
          }}
        >
          Offgrid Messenger 
        </Typography>
        
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: { xs: '2px', sm: '4px', md: '8px' }
        }}>
          {/* Connection status indicator */}
          <Tooltip title={connected ? 'Connected' : 'Disconnected'}>
            <IconButton color="inherit" size={isMobile ? "small" : "medium"}>
              {connected ? <WifiIcon /> : <WifiOffIcon />}
            </IconButton>
          </Tooltip>
          
          {/* Voice Call button */}
          <Tooltip title={!selectedPeer || !connected ? "Select a peer to call" : "Voice Call with peer"}>
            <span>
              <IconButton 
                color="inherit" 
                size={isMobile ? "small" : "medium"}
                disabled={!selectedPeer || !connected}
                onClick={onVoiceCall}
                sx={{
                  '&:hover': { 
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    transform: 'scale(1.1)',
                    transition: 'all 0.2s'
                  }
                }}
              >
                <CallIcon />
              </IconButton>
            </span>
          </Tooltip>
          
          {/* Video Call button */}
          <Tooltip title={!selectedPeer || !connected ? "Select a peer to call" : "Video Call"}>
            <span>
              <IconButton 
                color="inherit" 
                size={isMobile ? "small" : "medium"}
                disabled={!selectedPeer || !connected}
                onClick={onVideoCall}
                sx={{
                  '&:hover': { 
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    transform: 'scale(1.1)',
                    transition: 'all 0.2s'
                  }
                }}
              >
                <VideocamIcon />
              </IconButton>
            </span>
          </Tooltip>
          
          {/* Notifications button with future scope message */}
          {!isMobile && (
            <Tooltip title="Notifications feature will be available when the app is deployed and installed on a PC">
              <IconButton color="inherit" size={isMobile ? "small" : "medium"}>
                <Badge badgeContent={0} color="secondary">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
          
          {/* Clipboard sharing button with future scope message */}
          <Tooltip title={!selectedPeer || !connected ? 
            "Select a peer and ensure you're connected" : 
            "Share Clipboard Content (This feature will be fully functional when the app is deployed and installed on a PC)"}>
            <span>
              <IconButton 
                color="inherit" 
                size={isMobile ? "small" : "medium"}
                onClick={shareClipboard}
                disabled={!selectedPeer || !connected}
              >
                <ContentCopyIcon />
              </IconButton>
            </span>
          </Tooltip>
          
          {/* File transfer history button */}
          {!isTablet && (
            <Tooltip title="File Transfer History">
              <IconButton color="inherit" size={isMobile ? "small" : "medium"} onClick={onOpenFileHistory}>
                <HistoryIcon />
              </IconButton>
            </Tooltip>
          )}
          
          {/* Bulletin Board button */}
          <Tooltip title="Bulletin Board">
            <IconButton color="inherit" size={isMobile ? "small" : "medium"} onClick={onOpenBulletinBoard}>
              <AnnouncementIcon />
            </IconButton>
          </Tooltip>
          
          {/* Settings button */}
          <Tooltip title="Settings">
            <IconButton 
              color="inherit" 
              size={isMobile ? "small" : "medium"} 
              onClick={onOpenSettings}
              sx={{
                '&:hover': { 
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  transform: 'scale(1.1)',
                  transition: 'all 0.2s'
                }
              }}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          
          {/* User profile button */}
          <Box sx={{ ml: { xs: 0.5, sm: 1 } }}>
            <Tooltip title="Account">
              <IconButton
                onClick={handleClick}
                size="small"
                color="inherit"
                aria-controls={open ? 'account-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                sx={{
                  '&:hover': { 
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    transform: 'scale(1.05)',
                    transition: 'all 0.2s'
                  }
                }}
              >
                {user ? (
                  <Avatar sx={{ 
                    width: isMobile ? 28 : 32, 
                    height: isMobile ? 28 : 32, 
                    bgcolor: 'primary.dark',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}>
                    {user.username.charAt(0).toUpperCase()}
                  </Avatar>
                ) : (
                  <AccountCircleIcon />
                )}
              </IconButton>
            </Tooltip>
            <Menu
              id="account-menu"
              anchorEl={anchorEl}
              open={open}
              onClose={handleClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              PaperProps={{
                elevation: 3,
                sx: {
                  borderRadius: '8px',
                  overflow: 'visible',
                  mt: 1.5,
                  '&:before': {
                    content: '""',
                    display: 'block',
                    position: 'absolute',
                    top: 0,
                    right: 14,
                    width: 10,
                    height: 10,
                    bgcolor: 'background.paper',
                    transform: 'translateY(-50%) rotate(45deg)',
                    zIndex: 0,
                  },
                },
              }}
            >
              <MenuItem disabled>
                <Typography variant="body2">
                  Signed in as <strong>{user ? user.username : 'User'}</strong>
                </Typography>
              </MenuItem>
              <MenuItem onClick={handleLogout} sx={{ 
                '&:hover': { bgcolor: 'rgba(244, 67, 54, 0.08)' } 
              }}>
                <LogoutIcon fontSize="small" sx={{ mr: 1, color: 'error.main' }} />
                <Typography color="error.main">Logout</Typography>
              </MenuItem>
            </Menu>
          </Box>
        </Box>
        </Toolbar>
      </AppBar>
    );
  }

export default Header;
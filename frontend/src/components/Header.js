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
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SettingsIcon from '@mui/icons-material/Settings';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import NotificationsIcon from '@mui/icons-material/Notifications';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

function Header({ connected, shareClipboard, selectedPeer, onOpenSettings, user, onLogout }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  
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
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Offgrid Messenger 
        </Typography>
        
        {/* Connection status indicator */}
        <Tooltip title={connected ? 'Connected' : 'Disconnected'}>
          <IconButton color="inherit">
            {connected ? <WifiIcon /> : <WifiOffIcon />}
          </IconButton>
        </Tooltip>
        
        {/* Notifications button with future scope message */}
        <Tooltip title="Notifications feature will be available when the app is deployed and installed on a PC">
          <IconButton color="inherit">
            <Badge badgeContent={0} color="secondary">
              <NotificationsIcon />
            </Badge>
          </IconButton>
        </Tooltip>
        
        {/* Clipboard sharing button with future scope message */}
        <Tooltip title={!selectedPeer || !connected ? 
          "Select a peer and ensure you're connected" : 
          "Share Clipboard Content (This feature will be fully functional when the app is deployed and installed on a PC)"}>
          <span>
            <IconButton 
              color="inherit" 
              onClick={shareClipboard}
              disabled={!selectedPeer || !connected}
            >
              <ContentCopyIcon />
            </IconButton>
          </span>
        </Tooltip>
        
        {/* Settings button */}
        <Tooltip title="Settings">
          <IconButton color="inherit" onClick={onOpenSettings}>
            <SettingsIcon />
          </IconButton>
        </Tooltip>
        
        {/* User profile button */}
        <Box sx={{ ml: 1 }}>
          <Tooltip title="Account">
            <IconButton
              onClick={handleClick}
              size="small"
              color="inherit"
              aria-controls={open ? 'account-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={open ? 'true' : undefined}
            >
              {user ? (
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.dark' }}>
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
          >
            <MenuItem disabled>
              <Typography variant="body2">
                Signed in as <strong>{user ? user.username : 'User'}</strong>
              </Typography>
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Header;
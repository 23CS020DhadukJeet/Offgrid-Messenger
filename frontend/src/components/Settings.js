/**
 * Settings.js - Settings dialog component
 * 
 * This component provides a dialog for changing application settings
 * such as username and theme preference.
 */

import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Avatar from '@mui/material/Avatar';
import Paper from '@mui/material/Paper';
import LockIcon from '@mui/icons-material/Lock';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

function Settings({ open, onClose, username, onUsernameChange, darkMode, onThemeToggle, user }) {
  const [newUsername, setNewUsername] = useState(username);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setNewUsername(username);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
    }
  }, [open, username]);
  
  const handleSubmit = () => {
    if (newUsername.trim() !== username) {
      onUsernameChange(newUsername.trim());
    }
    
    // Password change logic would go here in a real implementation
    // For now, we'll just validate but not actually change the password
    if (newPassword) {
      if (newPassword !== confirmPassword) {
        setPasswordError('New passwords do not match');
        return;
      }
      
      if (!currentPassword) {
        setPasswordError('Current password is required');
        return;
      }
      
      // In a real app, we would call an API to change the password here
      console.log('Password change would happen here in a real implementation');
    }
    
    onClose();
  };
  
  const handleCancel = () => {
    setNewUsername(username); // Reset to original value
    onClose();
  };
  
  return (
    <Dialog open={open} onClose={handleCancel} fullWidth maxWidth="sm">
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        {/* User Profile Section */}
        <Box sx={{ mb: 3, mt: 1, display: 'flex', alignItems: 'center' }}>
          <Avatar 
            sx={{ width: 64, height: 64, bgcolor: 'primary.main', mr: 2 }}
          >
            {user ? user.username.charAt(0).toUpperCase() : <AccountCircleIcon />}
          </Avatar>
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              User Profile
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user ? `Account created: ${new Date(user.createdAt).toLocaleDateString()}` : 'Logged in user'}
            </Typography>
          </Box>
        </Box>
        
        <TextField
          margin="dense"
          id="username"
          label="Display Name"
          type="text"
          fullWidth
          variant="outlined"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          helperText="This name will be visible to other users on the network"
        />
        
        <Divider sx={{ my: 2 }} />
        
        {/* Password Change Section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Change Password
          </Typography>
          
          {passwordError && (
            <Typography variant="body2" color="error" sx={{ mb: 1 }}>
              {passwordError}
            </Typography>
          )}
          
          <TextField
            margin="dense"
            id="current-password"
            label="Current Password"
            type="password"
            fullWidth
            variant="outlined"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setPasswordError('');
            }}
          />
          
          <TextField
            margin="dense"
            id="new-password"
            label="New Password"
            type="password"
            fullWidth
            variant="outlined"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setPasswordError('');
            }}
          />
          
          <TextField
            margin="dense"
            id="confirm-password"
            label="Confirm New Password"
            type="password"
            fullWidth
            variant="outlined"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setPasswordError('');
            }}
          />
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        {/* Appearance Section */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Appearance
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={darkMode}
                onChange={(e) => onThemeToggle(e.target.checked)}
                color="primary"
              />
            }
            label="Dark Mode"
          />
          <DialogContentText variant="body2" sx={{ mt: 1 }}>
            Toggle between light and dark theme for the application
          </DialogContentText>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default Settings;
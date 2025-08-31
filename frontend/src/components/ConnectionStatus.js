/**
 * ConnectionStatus.js - Component for displaying connection status
 * 
 * This component shows the current connection status and provides
 * information about the local IP address and hostname.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';

function ConnectionStatus({ connected, localInfo }) {
  return (
    <Paper 
      elevation={0} 
      variant="outlined"
      sx={{ 
        p: 1.5, 
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 0,
        borderLeft: 0,
        borderRight: 0,
        borderBottom: 0
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Chip
          icon={connected ? <WifiIcon /> : <WifiOffIcon />}
          label={connected ? 'Connected' : 'Disconnected'}
          color={connected ? 'success' : 'error'}
          size="small"
          sx={{ mr: 2 }}
        />
        
        {connected && localInfo && (
          <Typography variant="body2" color="text.secondary">
            {localInfo.hostname} ({localInfo.ip})
          </Typography>
        )}
      </Box>
      
      {connected && (
        <Typography variant="body2" color="text.secondary">
          {new Date().toLocaleString()}
        </Typography>
      )}
    </Paper>
  );
}

export default ConnectionStatus;
/**
 * FileTransferItem.js - Component for displaying file transfer progress
 * 
 * This component shows the progress of a file transfer, including file name,
 * size, progress bar, and status. It also provides buttons to cancel or
 * retry the transfer if needed.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import CancelIcon from '@mui/icons-material/Cancel';
import ReplayIcon from '@mui/icons-material/Replay';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

function FileTransferItem({ transfer, onCancel, onRetry, onOpen }) {
  // Helper function to get status icon
  const getStatusIcon = () => {
    switch (transfer.status) {
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'cancelled':
        return <CancelIcon color="warning" />;
      default:
        return null;
    }
  };

  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        p: 2, 
        mb: 2,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle1" className="text-ellipsis" title={transfer.fileName}>
          {transfer.fileName}
        </Typography>
        
        <Chip 
          label={transfer.status} 
          size="small" 
          color={
            transfer.status === 'completed' ? 'success' :
            transfer.status === 'failed' ? 'error' :
            transfer.status === 'cancelled' ? 'warning' : 'primary'
          }
          icon={getStatusIcon()}
        />
      </Box>
      
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {formatFileSize(transfer.fileSize)} - {transfer.direction === 'upload' ? 'Sending to' : 'Receiving from'} {transfer.peerName}
        {transfer.groupName && ` (${transfer.groupName})`}
      </Typography>
      
      {/* Progress bar for in-progress transfers */}
      {transfer.status === 'in_progress' && (
        <Box sx={{ width: '100%', mb: 1 }}>
          <LinearProgress 
            variant="determinate" 
            value={transfer.progress} 
          />
          <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}>
            {Math.round(transfer.progress)}%
          </Typography>
        </Box>
      )}
      
      {/* Action buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
        {transfer.status === 'in_progress' && (
          <Tooltip title="Cancel Transfer">
            <IconButton size="small" onClick={() => onCancel(transfer.id)} color="error">
              <CancelIcon />
            </IconButton>
          </Tooltip>
        )}
        
        {(transfer.status === 'failed' || transfer.status === 'cancelled') && (
          <Tooltip title="Retry Transfer">
            <IconButton size="small" onClick={() => onRetry(transfer.id)} color="primary">
              <ReplayIcon />
            </IconButton>
          </Tooltip>
        )}
        
        {transfer.status === 'completed' && transfer.direction === 'download' && (
          <Tooltip title="Open File">
            <IconButton size="small" onClick={() => onOpen(transfer.id)} color="primary">
              <FolderOpenIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Paper>
  );
}

export default FileTransferItem;
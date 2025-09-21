/**
 * BulletinNotification.js - Component for displaying bulletin board notifications
 * 
 * This component displays notifications for new announcements with priority indicators.
 */

import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Chip,
  IconButton
} from '@mui/material';
import { 
  Announcement as AnnouncementIcon,
  Close as CloseIcon,
  Warning as WarningIcon, 
  Info as InfoIcon, 
  Flag as FlagIcon
} from '@mui/icons-material';

// Priority colors
const priorityColors = {
  low: '#8bc34a',    // Light green
  medium: '#ff9800', // Orange
  high: '#f44336'    // Red
};

// Priority icons
const PriorityIcon = ({ priority }) => {
  switch (priority) {
    case 'high':
      return <WarningIcon style={{ color: priorityColors.high }} />;
    case 'medium':
      return <FlagIcon style={{ color: priorityColors.medium }} />;
    case 'low':
      return <InfoIcon style={{ color: priorityColors.low }} />;
    default:
      return <InfoIcon style={{ color: priorityColors.low }} />;
  }
};

const BulletinNotification = ({ announcement, onClose, onClick }) => {
  const { title, priority, isGeneral, groupName } = announcement;
  
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 2, 
        mb: 2, 
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'space-between',
        borderLeft: `4px solid ${priorityColors[priority]}`,
        cursor: 'pointer'
      }}
      onClick={onClick}
    >
      <Box display="flex" alignItems="center">
        <AnnouncementIcon sx={{ mr: 1 }} />
        <Box>
          <Typography variant="subtitle1">
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isGeneral ? 'General Announcement' : `Group: ${groupName}`}
          </Typography>
        </Box>
      </Box>
      
      <Box display="flex" alignItems="center">
        <Chip 
          icon={<PriorityIcon priority={priority} />}
          label={priority.toUpperCase()} 
          size="small" 
          sx={{ 
            mr: 1,
            backgroundColor: priorityColors[priority],
            color: 'white'
          }} 
        />
        <IconButton size="small" onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Paper>
  );
};

export default BulletinNotification;
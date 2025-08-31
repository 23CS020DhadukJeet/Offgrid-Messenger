/**
 * NotificationItem.js - Component for displaying notifications
 * 
 * This component shows a notification with an icon, message, and timestamp.
 * It also provides a close button to dismiss the notification.
 * 
 * Features:
 * - Different icons based on notification type (message, file, clipboard, info)
 * - Title and message display with text overflow handling
 * - Timestamp display in local time format
 * - Close button for dismissing notifications
 * - Visual distinction between read and unread notifications
 */

import React from 'react';
import Box from '@mui/material/Box'; // Container for layout
import Paper from '@mui/material/Paper'; // Card-like container for notification
import Typography from '@mui/material/Typography'; // Text components
import IconButton from '@mui/material/IconButton'; // Close button
import CloseIcon from '@mui/icons-material/Close'; // X icon for close button
import MessageIcon from '@mui/icons-material/Message'; // Icon for chat messages
import FileDownloadIcon from '@mui/icons-material/FileDownload'; // Icon for file transfers
import ContentCopyIcon from '@mui/icons-material/ContentCopy'; // Icon for clipboard content
import InfoIcon from '@mui/icons-material/Info'; // Default icon for general notifications

/**
 * NotificationItem Component
 * 
 * @param {Object} notification - The notification object to display
 * @param {string} notification.id - Unique identifier for the notification
 * @param {string} notification.type - Type of notification (message, file, clipboard, info)
 * @param {string} notification.title - Main notification title
 * @param {string} notification.message - Detailed notification message
 * @param {number} notification.timestamp - Creation time in milliseconds
 * @param {boolean} notification.read - Whether the notification has been read
 * @param {Object} notification.data - Additional data specific to the notification type
 * @param {Function} onClose - Callback function to dismiss the notification
 * @returns {JSX.Element} A styled notification card
 */
function NotificationItem({ notification, onClose }) {
  /**
   * Selects the appropriate icon based on notification type
   * Each type has a different icon and color to help users quickly identify the notification category
   * 
   * @returns {JSX.Element} The icon component for the notification type
   */
  const getIcon = () => {
    switch (notification.type) {
      case 'message': // Chat message notification
        return <MessageIcon color="primary" />;
      case 'file': // File transfer notification
        return <FileDownloadIcon color="success" />;
      case 'clipboard': // Clipboard content notification
        return <ContentCopyIcon color="secondary" />;
      default: // General information notification
        return <InfoIcon color="info" />;
    }
  };

  /**
   * Render the notification as a Paper card with icon, content, and close button
   * The card has different background colors for read vs unread notifications
   */
  return (
    <Paper 
      elevation={2} // Slight shadow for depth
      sx={{ 
        p: 1.5, // Padding inside the card
        mb: 1, // Margin between notifications
        display: 'flex', // Horizontal layout
        alignItems: 'center', // Vertically center content
        backgroundColor: (theme) => 
          // Different background color based on read status
          notification.read ? theme.palette.background.paper : theme.palette.action.hover
      }}
    >
      {/* Left section - Icon */}
      <Box sx={{ mr: 1.5 }}>
        {getIcon()} {/* Dynamic icon based on notification type */}
      </Box>
      
      {/* Middle section - Content */}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}> {/* Flex grow to take available space, minWidth for text truncation */}
        {/* Title with ellipsis for overflow */}
        <Typography variant="body1" className="text-ellipsis">
          {notification.title}
        </Typography>
        
        {/* Message with ellipsis for overflow */}
        <Typography variant="body2" color="text.secondary" className="text-ellipsis">
          {notification.message}
        </Typography>
        
        {/* Timestamp in local time format */}
        <Typography variant="caption" color="text.secondary">
          {new Date(notification.timestamp).toLocaleTimeString()}
        </Typography>
      </Box>
      
      {/* Right section - Close button */}
      <IconButton 
        size="small" 
        onClick={() => onClose(notification.id)} // Call onClose with notification ID
        sx={{ ml: 1 }} // Margin to separate from content
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
}

export default NotificationItem;
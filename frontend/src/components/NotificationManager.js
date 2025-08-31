/**
 * NotificationManager.js - Component for managing notifications
 * 
 * This component manages the display of notifications in the application,
 * including system notifications and in-app notifications.
 * 
 * It handles:
 * - Requesting browser notification permissions
 * - Displaying in-app notifications in a sliding panel
 * - Auto-dismissing notifications after a timeout
 * - Animating notifications entry and exit
 */

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box'; // Container for notifications
import Slide from '@mui/material/Slide'; // Animation for notification entry/exit
import NotificationItem from './NotificationItem'; // Individual notification component
import { isNotificationSupported, requestPermission } from '../services/notificationService'; // Notification permission utilities

/**
 * NotificationManager Component
 * 
 * @param {Object[]} notifications - Array of notification objects to display
 * @param {Function} onDismiss - Callback function to dismiss a notification by ID
 * @returns {JSX.Element} Notification panel with animated notification items
 */
function NotificationManager({ notifications, onDismiss }) {
  // Track if browser notifications are permitted
  const [permissionGranted, setPermissionGranted] = useState(false);
  
  /**
   * Request notification permission when component mounts
   * This allows the app to show system notifications outside the browser window
   */
  useEffect(() => {
    const checkPermission = async () => {
      if (isNotificationSupported()) {
        const granted = await requestPermission();
        setPermissionGranted(granted);
      }
    };
    
    checkPermission();
  }, []);
  
  /**
   * Auto-dismiss notifications after a timeout period
   * Creates a separate timer for each notification and cleans up on unmount or when notifications change
   * 
   * This prevents notifications from accumulating and cluttering the UI
   */
  useEffect(() => {
    // Create a timeout for each notification in the array
    const timers = notifications.map(notification => {
      // Auto-dismiss after 7 seconds
      return setTimeout(() => {
        onDismiss(notification.id);
      }, 7000);
    });
    
    // Cleanup function to prevent memory leaks
    return () => {
      // Clear all timers when component unmounts or notifications change
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [notifications, onDismiss]); // Re-run when notifications array or dismiss function changes

  /**
   * Render the notification panel with animated notification items
   * 
   * The Box component creates a fixed position container at the bottom right of the screen
   * Each notification slides in from the right with a staggered delay based on its position
   */
  return (
    <Box 
      sx={{ 
        position: 'fixed', // Fixed position relative to the viewport
        bottom: 16, // Distance from bottom of screen
        right: 16, // Distance from right of screen
        width: 320, // Fixed width for all notifications
        maxHeight: '70vh', // Limit height to 70% of viewport height
        overflow: 'auto', // Add scrolling if too many notifications
        zIndex: 1000, // Ensure notifications appear above other content
        display: 'flex',
        flexDirection: 'column-reverse', // Show newest notifications at the bottom
      }}
    >
      {/* Map through each notification and create a sliding animation */}
      {notifications.map((notification, index) => (
        <Slide 
          key={notification.id} // Unique key for React's reconciliation
          direction="left" // Slide in from right to left
          in={true} // Always show (removal handled by parent component)
          mountOnEnter // Only render when notification should be visible
          unmountOnExit // Remove from DOM when animation completes
          timeout={300} // Animation duration in milliseconds
          style={{ 
            transitionDelay: `${index * 50}ms`, // Stagger animations by 50ms per notification
          }}
        >
          <div>
            {/* Individual notification component with close handler */}
            <NotificationItem 
              notification={notification} 
              onClose={onDismiss} // Pass the dismiss function to each notification
            />
          </div>
        </Slide>
      ))}
    </Box>
  );
}

export default NotificationManager;
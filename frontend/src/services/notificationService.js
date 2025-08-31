/**
 * notificationService.js - Service for handling notifications
 * 
 * This service provides functions for creating and managing notifications,
 * including system notifications and in-app notifications.
 * 
 * Features:
 * - Browser notification permission management
 * - System notification display (browser or Electron)
 * - In-app notification object creation
 * - Cross-platform notification support
 */

/**
 * Check if the browser supports the Notification API
 * 
 * @returns {boolean} True if the browser supports notifications, false otherwise
 */
const isNotificationSupported = () => {
  return 'Notification' in window; // Check if Notification object exists in window
};

/**
 * Request permission to display system notifications
 * 
 * This function handles the browser permission flow for notifications:
 * 1. Checks if notifications are supported
 * 2. Returns true immediately if permission is already granted
 * 3. Requests permission if not previously denied
 * 4. Returns the permission status
 * 
 * @returns {Promise<boolean>} Promise resolving to true if permission granted, false otherwise
 */
const requestPermission = async () => {
  // First check if notifications are supported at all
  if (!isNotificationSupported()) {
    console.warn('Notifications are not supported in this browser');
    return false;
  }
  
  // If permission is already granted, return true immediately
  if (Notification.permission === 'granted') {
    return true;
  }
  
  // If permission is not explicitly denied, request it
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  // Permission was previously denied
  return false;
};

/**
 * Display a system notification using the appropriate platform API
 * 
 * This function handles cross-platform notification display:
 * - In Electron, it uses the Electron notification API
 * - In browsers, it uses the Web Notification API
 * 
 * @param {string} title - The notification title
 * @param {Object} options - Notification options
 * @param {string} [options.body=''] - The notification message body
 * @param {string} [options.icon='/logo192.svg'] - The notification icon URL
 * @param {Function} [options.onClick] - Click handler for browser notifications
 * @returns {Promise<boolean>} Promise resolving to true if notification was shown, false otherwise
 */
const showSystemNotification = async (title, options = {}) => {
  // If we're in Electron desktop environment, use the Electron notification API
  if (window.electron) {
    window.electron.showNotification({
      title,
      body: options.body || '', // Use provided body or empty string
    });
    return true; // Electron notifications don't require permission
  }
  
  // For browser environment, use the Web Notification API
  if (await requestPermission()) { // Request permission if needed
    // Create a new browser notification
    const notification = new Notification(title, {
      body: options.body || '', // Use provided body or empty string
      icon: options.icon || '/logo192.svg', // Use provided icon or default app icon
      ...options // Spread any additional options
    });
    
    // Attach click handler if provided
    if (options.onClick) {
      notification.onclick = options.onClick;
    }
    
    return true; // Notification was successfully shown
  }
  
  return false; // Permission denied or not available
};

/**
 * Create a notification object for the in-app notification system
 * 
 * This function generates a standardized notification object with:
 * - Unique ID based on timestamp
 * - Type classification (message, file, clipboard, info)
 * - Title and message content
 * - Creation timestamp
 * - Read status (initially unread)
 * - Optional additional data
 * 
 * @param {string} type - The notification type (message, file, clipboard, info)
 * @param {string} title - The notification title
 * @param {string} message - The notification message
 * @param {Object} data - Additional data specific to the notification type
 * @returns {Object} A notification object for the in-app notification system
 */
const createNotification = (type, title, message, data = {}) => {
  return {
    id: Date.now().toString(), // Generate unique ID from current timestamp
    type, // Type of notification (message, file, clipboard, info)
    title, // Main notification heading
    message, // Detailed notification content
    timestamp: Date.now(), // When the notification was created
    read: false, // Initially unread
    data // Additional data specific to this notification type
  };
};

export {
  isNotificationSupported,
  requestPermission,
  showSystemNotification,
  createNotification
};
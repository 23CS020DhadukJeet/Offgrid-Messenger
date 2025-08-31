/**
 * clipboardService.js - Service for handling clipboard operations
 * 
 * This service provides a cross-platform clipboard management system with the following capabilities:
 * - Reading from the clipboard (getClipboardContent)
 * - Writing to the clipboard (setClipboardContent)
 * - Sharing clipboard content with peers (shareClipboardWithPeer)
 * 
 * The service handles both Electron desktop and browser environments:
 * - In Electron: Uses IPC to communicate with the main process for clipboard access
 * - In browser: Uses the Web Clipboard API with appropriate permissions
 * 
 * This abstraction allows the application to work consistently across platforms
 * while providing appropriate fallbacks when needed.
 */

/**
 * Get the current content from the system clipboard
 * 
 * This function retrieves text content from the clipboard using platform-specific methods:
 * - In Electron: Uses IPC to request clipboard content from the main process
 * - In browser: Uses the navigator.clipboard API with appropriate permissions
 * 
 * The function handles errors gracefully and returns null if clipboard access fails,
 * which can happen due to permissions or if the clipboard contains non-text content.
 * 
 * @returns {Promise<string|null>} The clipboard text content or null if unavailable/error
 */
const getClipboardContent = async () => {
  // Check if running in Electron environment
  if (window.electron) {
    try {
      // Use Electron IPC to get clipboard content from main process
      const content = await window.electron.getClipboard();
      return content;
    } catch (error) {
      console.error('Error getting clipboard content:', error);
      return null;
    }
  } else {
    // Fallback for browser environment (for testing)
    try {
      // Use Web Clipboard API (requires permission in browsers)
      const content = await navigator.clipboard.readText();
      return content;
    } catch (error) {
      console.error('Error reading from clipboard:', error);
      return null;
    }
  }
};

/**
 * Set content to the system clipboard
 * 
 * This function writes text content to the clipboard using platform-specific methods:
 * - In Electron: Uses IPC to send content to the main process for clipboard writing
 * - In browser: Uses the navigator.clipboard API with appropriate permissions
 * 
 * The function validates input, handles errors gracefully, and returns a boolean
 * indicating success or failure of the clipboard operation.
 * 
 * @param {string} content - The text content to write to the clipboard
 * @returns {Promise<boolean>} True if successful, false if failed or empty content
 */
const setClipboardContent = async (content) => {
  // Validate input - don't proceed with empty content
  if (!content) return false;
  
  // Check if running in Electron environment
  if (window.electron) {
    try {
      // Use Electron IPC to set clipboard content via main process
      await window.electron.setClipboard(content);
      return true;
    } catch (error) {
      console.error('Error setting clipboard content:', error);
      return false;
    }
  } else {
    // Fallback for browser environment (for testing)
    try {
      // Use Web Clipboard API (requires permission in browsers)
      await navigator.clipboard.writeText(content);
      return true;
    } catch (error) {
      console.error('Error writing to clipboard:', error);
      return false;
    }
  }
};

/**
 * Share clipboard content with a specific peer
 * 
 * This function combines clipboard reading and peer messaging to share clipboard content:
 * 1. Validates the peer ID is provided
 * 2. Gets the current clipboard content
 * 3. Sends the content to the specified peer through the appropriate channel
 * 
 * Currently, this functionality is primarily supported in the Electron environment
 * where the main process handles the WebSocket communication with peers.
 * 
 * @param {string} peerId - The ID of the peer to share clipboard content with
 * @returns {Promise<boolean>} True if successfully shared, false otherwise
 */
const shareClipboardWithPeer = async (peerId) => {
  // Validate peer ID
  if (!peerId) return false;
  
  // Get current clipboard content
  const content = await getClipboardContent();
  // Validate content exists
  if (!content) return false;
  
  // Currently only supported in Electron environment
  if (window.electron) {
    try {
      // Use Electron IPC to share clipboard with peer via main process
      await window.electron.shareClipboard({
        peerId,
        content
      });
      return true;
    } catch (error) {
      console.error('Error sharing clipboard content:', error);
      return false;
    }
  }
  
  // Return false for browser environment (not implemented)
  return false;
};

/**
 * Export the clipboard service functions for use throughout the application
 * 
 * These functions provide a complete clipboard management system that works
 * across different platforms and environments while maintaining a consistent API.
 */
export {
  getClipboardContent,    // Read from clipboard
  setClipboardContent,     // Write to clipboard
  shareClipboardWithPeer   // Share clipboard with a peer
};
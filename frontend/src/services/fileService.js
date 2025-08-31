/**
 * fileService.js - Service for handling file operations
 * 
 * This service provides a comprehensive file management system with the following capabilities:
 * - File selection through system dialogs (selectFile)
 * - File metadata handling and formatting (formatFileSize, getFileExtension)
 * - File type detection (isImageFile)
 * - File transfer object creation and management (createFileTransfer)
 * - File opening functionality (openFile)
 * 
 * The service handles both Electron desktop and browser environments:
 * - In Electron: Uses IPC to communicate with the main process for file system access
 * - In browser: Uses the Web File API with appropriate fallbacks
 * 
 * This abstraction allows the application to work consistently across platforms
 * while providing appropriate fallbacks when needed.
 */

/**
 * Format file size in human-readable format
 * 
 * This function converts raw byte counts into a user-friendly size representation
 * using appropriate units (Bytes, KB, MB, GB, TB) with decimal precision.
 * 
 * The conversion uses the binary definition where 1 KB = 1024 Bytes,
 * and maintains 2 decimal places of precision for readability.
 * 
 * @param {number} bytes - The file size in bytes
 * @returns {string} - Formatted file size with appropriate unit (e.g., "2.50 MB")
 */
const formatFileSize = (bytes) => {
  // Handle zero bytes case
  if (bytes === 0) return '0 Bytes';
  
  // Use binary definition (1024) rather than decimal (1000)
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  // Calculate the appropriate unit index using logarithms
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  // Format with 2 decimal places and add the appropriate unit
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Extract file extension from a file name
 * 
 * This function parses a file name and returns its extension (the part after the last dot).
 * It uses a bitwise operation for performance and handles edge cases where:
 * - The file has no extension
 * - The file name starts with a dot (hidden files in Unix-like systems)
 * - The file name contains multiple dots
 * 
 * @param {string} fileName - The name of the file including extension
 * @returns {string} - The file extension without the dot (e.g., "pdf", "jpg")
 */
const getFileExtension = (fileName) => {
  // The bitwise operation (>>> 0) handles cases where lastIndexOf returns -1
  // by converting it to a large positive number, ensuring the slice starts at position 0
  return fileName.slice((fileName.lastIndexOf('.') - 1 >>> 0) + 2);
};

/**
 * Determine if a file is an image based on its extension
 * 
 * This function checks if the file extension matches common image formats.
 * It converts the extension to lowercase to ensure case-insensitive matching
 * and compares against a predefined list of image file extensions.
 * 
 * @param {string} fileName - The name of the file to check
 * @returns {boolean} - True if the file is an image, false otherwise
 */
const isImageFile = (fileName) => {
  // Get extension and convert to lowercase for case-insensitive comparison
  const ext = getFileExtension(fileName).toLowerCase();
  // Check against common image file extensions
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
};

/**
 * Create a file transfer object for tracking transfer state
 * 
 * This function generates a structured object containing all necessary information
 * to track and display a file transfer, including:
 * - Unique identifier and timestamps
 * - File metadata (name, size, type)
 * - Peer information (who is sending/receiving)
 * - Transfer state (progress, status, direction)
 * 
 * The direction parameter indicates whether this is an upload (sending to peer)
 * or download (receiving from peer).
 * 
 * @param {File|Object} file - The file object with metadata (name, size, type, etc.)
 * @param {string} peerId - ID of the peer involved in the transfer
 * @param {string} peerName - Display name of the peer
 * @param {string} direction - Direction of transfer ('upload' or 'download')
 * @returns {Object} - A complete file transfer tracking object
 */
const createFileTransfer = (file, peerId, peerName, direction = 'upload') => {
  return {
    id: Date.now().toString(),                              // Unique identifier for this transfer
    fileName: file.name,                                    // Original file name
    fileSize: file.size,                                    // File size in bytes
    fileType: file.type || getFileExtension(file.name),     // MIME type or extension
    peerId,                                                 // ID of the peer
    peerName,                                               // Display name of the peer
    direction,                                              // 'upload' or 'download'
    progress: 0,                                            // Initial progress (0-100)
    status: 'pending',                                      // Initial status
    timestamp: Date.now(),                                  // When the transfer was created
    filePath: file.path || null                             // Local file path (Electron only)
  };
};

/**
 * Open a file selection dialog and return the selected file
 * 
 * This function provides a cross-platform way to select files:
 * - In Electron: Uses the native file dialog via IPC
 * - In browser: Creates a temporary file input element
 * 
 * The function handles the differences between environments:
 * - Electron returns a file path that needs additional metadata
 * - Browser returns a File object with built-in metadata
 * 
 * @returns {Promise<File|Object|null>} - The selected file object or null if cancelled
 */
const selectFile = async () => {
  // Check if running in Electron environment
  if (window.electron) {
    try {
      // Use Electron's native file dialog
      const filePath = await window.electron.selectFile();
      if (filePath) {
        // The Electron API returns file path, we need to get file info
        const fileInfo = await window.electron.getFileInfo(filePath);
        return fileInfo;
      }
    } catch (error) {
      console.error('Error selecting file:', error);
    }
  } else {
    // Fallback for browser environment (for testing)
    return new Promise((resolve) => {
      // Create a temporary file input element
      const input = document.createElement('input');
      input.type = 'file';
      
      // Handle file selection
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          resolve(file);
        } else {
          resolve(null);
        }
      };
      
      // Trigger the file dialog
      input.click();
    });
  }
  
  // Return null if file selection failed or was cancelled
  return null;
};

/**
 * Open a file with the system's default application
 * 
 * This function attempts to open a file using the appropriate method:
 * - In Electron: Uses the shell.openPath API via IPC
 * - In browser: Not supported (returns false)
 * 
 * The function is primarily designed for the desktop environment where
 * the application has access to the local file system.
 * 
 * @param {string} filePath - The absolute path to the file to open
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
const openFile = async (filePath) => {
  // This functionality is only available in Electron
  if (window.electron) {
    try {
      // Use Electron's shell.openPath API via IPC
      await window.electron.openFile(filePath);
      return true;
    } catch (error) {
      console.error('Error opening file:', error);
      return false;
    }
  }
  
  // Not supported in browser environment
  return false;
};

/**
 * Export the file service functions for use throughout the application
 * 
 * These functions provide a complete file management system that works
 * across different platforms and environments while maintaining a consistent API.
 */
export {
  formatFileSize,       // Convert bytes to human-readable format
  getFileExtension,      // Extract extension from filename
  isImageFile,           // Check if file is an image type
  createFileTransfer,    // Create file transfer tracking object
  selectFile,            // Open file selection dialog
  openFile               // Open file with system application
};
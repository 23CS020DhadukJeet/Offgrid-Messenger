/**
 * preload.js - Electron preload script for IP Messenger Clone
 * 
 * This file exposes specific Electron APIs to the renderer process
 * through the contextBridge, allowing secure communication between
 * the renderer and main processes.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    // Send messages to main process
    sendMessage: (message) => {
      ipcRenderer.send('send-message', message);
    },
    
    // File operations
    selectFile: () => {
      ipcRenderer.send('select-file');
    },
    openFile: (filePath) => {
      ipcRenderer.send('open-file', filePath);
    },
    
    // Clipboard operations
    getClipboardContent: () => {
      ipcRenderer.send('get-clipboard-content');
    },
    setClipboardContent: (text) => {
      ipcRenderer.send('set-clipboard-content', text);
    },
    
    // Notifications
    showNotification: (notification) => {
      ipcRenderer.send('show-notification', notification);
    },
    
    // Receive events from main process
    on: (channel, callback) => {
      // Whitelist channels to listen to
      const validChannels = [
        'file-selected',
        'clipboard-content',
        'clipboard-set-success',
        'file-not-found',
        'backend-log',
        'backend-error',
        'backend-stopped'
      ];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender` 
        ipcRenderer.on(channel, (event, ...args) => callback(...args));
      }
    },
    
    // Remove event listeners
    removeAllListeners: (channel) => {
      const validChannels = [
        'file-selected',
        'clipboard-content',
        'clipboard-set-success',
        'file-not-found',
        'backend-log',
        'backend-error',
        'backend-stopped'
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.removeAllListeners(channel);
      }
    }
  }
);
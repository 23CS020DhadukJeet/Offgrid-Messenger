/**
 * fileTransferHistoryService.js - Service for managing file transfer history
 * 
 * This service handles storing, retrieving, and managing file transfer history
 * including sender/receiver information, timestamps, and transfer status.
 */

// Store file transfer history in localStorage
const HISTORY_KEY = 'fileTransferHistory';
const MAX_HISTORY_ITEMS = 1000; // Maximum number of history items to keep

/**
 * Get file transfer history from localStorage
 * @returns {Array} - Array of file transfer history items
 */
export const getFileTransferHistory = () => {
  try {
    const history = localStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error('Error loading file transfer history:', error);
    return [];
  }
};

/**
 * Save file transfer history to localStorage
 * @param {Array} history - Array of file transfer history items
 */
const saveFileTransferHistory = (history) => {
  try {
    // Keep only the most recent items
    const limitedHistory = history.slice(-MAX_HISTORY_ITEMS);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(limitedHistory));
  } catch (error) {
    console.error('Error saving file transfer history:', error);
  }
};

/**
 * Add a new file transfer to history
 * @param {Object} transfer - File transfer object
 * @param {string} transfer.id - Transfer ID
 * @param {string} transfer.fileName - File name
 * @param {number} transfer.fileSize - File size in bytes
 * @param {string} transfer.peerId - Peer ID
 * @param {string} transfer.peerName - Peer display name
 * @param {string} transfer.direction - Transfer direction ('upload' or 'download')
 * @param {string} transfer.status - Transfer status
 * @param {number} transfer.progress - Transfer progress (0-100)
 * @param {number} transfer.timestamp - Transfer timestamp
 * @param {string} [transfer.groupId] - Group ID if it's a group transfer
 * @param {string} [transfer.groupName] - Group name if it's a group transfer
 */
export const addFileTransferToHistory = (transfer) => {
  const history = getFileTransferHistory();
  
  // Check if transfer already exists in history
  const existingIndex = history.findIndex(item => item.id === transfer.id);
  
  const historyItem = {
    id: transfer.id,
    fileName: transfer.fileName,
    fileSize: transfer.fileSize,
    peerId: transfer.peerId,
    peerName: transfer.peerName,
    direction: transfer.direction,
    status: transfer.status,
    progress: transfer.progress || 0,
    timestamp: transfer.timestamp || Date.now(),
    groupId: transfer.groupId || null,
    groupName: transfer.groupName || null,
    completedAt: transfer.status === 'completed' ? Date.now() : null,
    errorMessage: transfer.errorMessage || null
  };
  
  if (existingIndex >= 0) {
    // Update existing item
    history[existingIndex] = historyItem;
  } else {
    // Add new item
    history.push(historyItem);
  }
  
  saveFileTransferHistory(history);
  return historyItem;
};

/**
 * Update an existing file transfer in history
 * @param {string} transferId - Transfer ID
 * @param {Object} updates - Updates to apply
 */
export const updateFileTransferInHistory = (transferId, updates) => {
  const history = getFileTransferHistory();
  const index = history.findIndex(item => item.id === transferId);
  
  if (index >= 0) {
    history[index] = { ...history[index], ...updates };
    if (updates.status === 'completed') {
      history[index].completedAt = Date.now();
    }
    saveFileTransferHistory(history);
  }
};

/**
 * Get file transfer history filtered by criteria
 * @param {Object} filters - Filter criteria
 * @param {string} [filters.direction] - Filter by direction ('upload' or 'download')
 * @param {string} [filters.status] - Filter by status
 * @param {string} [filters.peerId] - Filter by peer ID
 * @param {string} [filters.groupId] - Filter by group ID
 * @param {number} [filters.limit] - Maximum number of items to return
 * @returns {Array} - Filtered file transfer history
 */
export const getFilteredFileTransferHistory = (filters = {}) => {
  let history = getFileTransferHistory();
  
  // Apply filters
  if (filters.direction) {
    history = history.filter(item => item.direction === filters.direction);
  }
  
  if (filters.status) {
    history = history.filter(item => item.status === filters.status);
  }
  
  if (filters.peerId) {
    history = history.filter(item => item.peerId === filters.peerId);
  }
  
  if (filters.groupId) {
    history = history.filter(item => item.groupId === filters.groupId);
  }
  
  // Sort by timestamp (newest first)
  history.sort((a, b) => b.timestamp - a.timestamp);
  
  // Apply limit
  if (filters.limit) {
    history = history.slice(0, filters.limit);
  }
  
  return history;
};

/**
 * Get file transfer statistics
 * @returns {Object} - Transfer statistics
 */
export const getFileTransferStats = () => {
  const history = getFileTransferHistory();
  
  const stats = {
    total: history.length,
    completed: history.filter(item => item.status === 'completed').length,
    failed: history.filter(item => item.status === 'failed').length,
    cancelled: history.filter(item => item.status === 'cancelled').length,
    uploads: history.filter(item => item.direction === 'upload').length,
    downloads: history.filter(item => item.direction === 'download').length,
    totalSize: history.reduce((sum, item) => sum + (item.fileSize || 0), 0),
    completedSize: history
      .filter(item => item.status === 'completed')
      .reduce((sum, item) => sum + (item.fileSize || 0), 0)
  };
  
  return stats;
};

/**
 * Clear file transfer history
 * @param {Object} [filters] - Optional filters to clear specific items
 */
export const clearFileTransferHistory = (filters = {}) => {
  if (Object.keys(filters).length === 0) {
    // Clear all history
    localStorage.removeItem(HISTORY_KEY);
  } else {
    // Clear filtered history
    const history = getFileTransferHistory();
    const filteredHistory = history.filter(item => {
      // Keep items that don't match the filters
      if (filters.direction && item.direction === filters.direction) return false;
      if (filters.status && item.status === filters.status) return false;
      if (filters.peerId && item.peerId === filters.peerId) return false;
      if (filters.groupId && item.groupId === filters.groupId) return false;
      return true;
    });
    saveFileTransferHistory(filteredHistory);
  }
};

/**
 * Get recent file transfers (last 24 hours)
 * @returns {Array} - Recent file transfers
 */
export const getRecentFileTransfers = () => {
  const history = getFileTransferHistory();
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  
  return history
    .filter(item => item.timestamp > oneDayAgo)
    .sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Search file transfer history by file name
 * @param {string} query - Search query
 * @returns {Array} - Matching file transfers
 */
export const searchFileTransferHistory = (query) => {
  const history = getFileTransferHistory();
  const lowercaseQuery = query.toLowerCase();
  
  return history
    .filter(item => 
      item.fileName.toLowerCase().includes(lowercaseQuery) ||
      item.peerName.toLowerCase().includes(lowercaseQuery) ||
      (item.groupName && item.groupName.toLowerCase().includes(lowercaseQuery))
    )
    .sort((a, b) => b.timestamp - a.timestamp);
};

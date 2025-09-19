/**
 * groupFileService.js - Service for handling group file transfers
 * 
 * This service extends the file transfer functionality to work with groups,
 * allowing files to be shared with all members of a group.
 */

import { sendGroupFileRequest, sendGroupFileChunk, sendGroupFileComplete } from './groupService';

// Store ongoing group file transfers
const activeGroupTransfers = new Map();

// Default chunk size for file transfers (1MB)
const DEFAULT_CHUNK_SIZE = 1024 * 1024;

/**
 * Generate a unique file transfer ID
 * @returns {string} - Unique ID for the file transfer
 */
function generateTransferId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Send a file to a group
 * @param {File} file - File to send
 * @param {string} groupId - Group ID
 * @param {string} senderId - Sender ID
 * @param {Function} sendMessage - WebSocket send function
 * @returns {Promise<string>} - Transfer ID
 */
export const sendFileToGroup = async (file, groupId, senderId, sendMessage) => {
  return new Promise((resolve, reject) => {
    const transferId = generateTransferId();
    const totalChunks = Math.ceil(file.size / DEFAULT_CHUNK_SIZE);
    
    // Store transfer information
    activeGroupTransfers.set(transferId, {
      file,
      groupId,
      senderId,
      totalChunks,
      sentChunks: 0,
      startTime: Date.now(),
      status: 'initiating'
    });
    
    // Send file transfer request to the group
    const success = sendGroupFileRequest(
      groupId,
      transferId,
      file.name,
      file.size,
      senderId,
      sendMessage
    );
    
    if (success) {
      console.log(`Group file transfer request sent for ${file.name}`);
      activeGroupTransfers.get(transferId).status = 'awaiting_acceptance';
      resolve(transferId);
    } else {
      activeGroupTransfers.delete(transferId);
      reject(new Error('Failed to send group file transfer request'));
    }
  });
};

/**
 * Handle group file transfer request
 * @param {Object} data - File transfer request data
 * @param {Function} onFileReceived - Callback when file is received
 */
export const handleGroupFileRequest = (data, onFileReceived) => {
  const { groupId, transferId, fileName, fileSize, senderId } = data;
  
  console.log(`Received group file transfer request for ${fileName} (${fileSize} bytes)`);
  
  // Store information about the incoming transfer
  activeGroupTransfers.set(transferId, {
    fileName,
    fileSize,
    senderId,
    groupId,
    totalChunks: Math.ceil(fileSize / DEFAULT_CHUNK_SIZE),
    receivedChunks: 0,
    chunks: new Map(),
    startTime: Date.now(),
    status: 'receiving'
  });
  
  // Notify UI about the incoming file
  if (onFileReceived) {
    onFileReceived({
      transferId,
      fileName,
      fileSize,
      senderId,
      groupId,
      progress: 0,
      status: 'receiving'
    });
  }
};

/**
 * Handle group file chunk
 * @param {Object} data - File chunk data
 * @param {Function} onProgress - Progress callback
 * @param {Function} onComplete - Completion callback
 */
export const handleGroupFileChunk = (data, onProgress, onComplete) => {
  const { groupId, transferId, chunkIndex, totalChunks, chunkSize, data: chunkData, senderId } = data;
  
  // Get the transfer information
  const transfer = activeGroupTransfers.get(transferId);
  
  if (!transfer || transfer.status !== 'receiving') {
    console.error(`Received chunk for unknown or inactive transfer: ${transferId}`);
    return;
  }
  
  // Store the chunk
  transfer.chunks.set(chunkIndex, chunkData);
  transfer.receivedChunks++;
  
  // Calculate progress
  const progress = Math.floor((transfer.receivedChunks / transfer.totalChunks) * 100);
  
  // Update progress
  if (onProgress) {
    onProgress({
      transferId,
      fileName: transfer.fileName,
      progress,
      senderId,
      groupId
    });
  }
  
  // Check if all chunks have been received
  if (transfer.receivedChunks === transfer.totalChunks) {
    console.log(`All chunks received for ${transfer.fileName}`);
    // Reassemble the file
    reassembleGroupFile(transferId, onComplete);
  }
};

/**
 * Reassemble received file chunks
 * @param {string} transferId - Transfer ID
 * @param {Function} onComplete - Completion callback
 */
function reassembleGroupFile(transferId, onComplete) {
  const transfer = activeGroupTransfers.get(transferId);
  
  if (!transfer) {
    return;
  }
  
  try {
    // Create a blob from the chunks
    const chunks = [];
    for (let i = 0; i < transfer.totalChunks; i++) {
      const chunk = transfer.chunks.get(i);
      if (chunk) {
        // Convert base64 to Uint8Array
        const binaryString = atob(chunk);
        const bytes = new Uint8Array(binaryString.length);
        for (let j = 0; j < binaryString.length; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }
        chunks.push(bytes);
      } else {
        throw new Error(`Missing chunk ${i} for file ${transfer.fileName}`);
      }
    }
    
    // Combine chunks into a single blob
    const blob = new Blob(chunks, { type: 'application/octet-stream' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = transfer.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Update transfer status
    transfer.status = 'completed';
    transfer.progress = 100;
    
    // Notify completion
    if (onComplete) {
      onComplete({
        transferId,
        fileName: transfer.fileName,
        fileSize: transfer.fileSize,
        senderId: transfer.senderId,
        groupId: transfer.groupId,
        progress: 100,
        status: 'completed'
      });
    }
    
    // Clean up after a delay
    setTimeout(() => {
      activeGroupTransfers.delete(transferId);
    }, 5000);
    
  } catch (error) {
    console.error(`Error reassembling file ${transfer.fileName}:`, error);
    transfer.status = 'error';
    
    if (onComplete) {
      onComplete({
        transferId,
        fileName: transfer.fileName,
        senderId: transfer.senderId,
        groupId: transfer.groupId,
        progress: 0,
        status: 'error',
        error: error.message
      });
    }
  }
}

/**
 * Handle group file transfer completion
 * @param {Object} data - Completion data
 * @param {Function} onComplete - Completion callback
 */
export const handleGroupFileComplete = (data, onComplete) => {
  const { groupId, transferId, senderId } = data;
  
  const transfer = activeGroupTransfers.get(transferId);
  if (transfer) {
    transfer.status = 'completed';
    transfer.progress = 100;
    
    if (onComplete) {
      onComplete({
        transferId,
        fileName: transfer.fileName,
        fileSize: transfer.fileSize,
        senderId,
        groupId,
        progress: 100,
        status: 'completed'
      });
    }
  }
};

/**
 * Start sending file chunks to group
 * @param {string} transferId - Transfer ID
 * @param {Function} sendMessage - WebSocket send function
 */
export const startSendingGroupFile = (transferId, sendMessage) => {
  const transfer = activeGroupTransfers.get(transferId);
  
  if (!transfer || transfer.status !== 'awaiting_acceptance') {
    return;
  }
  
  transfer.status = 'sending';
  sendNextGroupChunk(transferId, sendMessage);
};

/**
 * Send the next chunk of a group file transfer
 * @param {string} transferId - Transfer ID
 * @param {Function} sendMessage - WebSocket send function
 */
function sendNextGroupChunk(transferId, sendMessage) {
  const transfer = activeGroupTransfers.get(transferId);
  
  if (!transfer || transfer.status !== 'sending') {
    return;
  }
  
  // Check if all chunks have been sent
  if (transfer.sentChunks >= transfer.totalChunks) {
    console.log(`All chunks sent for ${transfer.fileName}`);
    transfer.status = 'completed';
    
    // Send completion message
    sendGroupFileComplete(
      transfer.groupId,
      transferId,
      transfer.senderId,
      sendMessage
    );
    
    // Clean up after a delay
    setTimeout(() => {
      activeGroupTransfers.delete(transferId);
    }, 5000);
    
    return;
  }
  
  // Calculate chunk position and size
  const chunkIndex = transfer.sentChunks;
  const position = chunkIndex * DEFAULT_CHUNK_SIZE;
  const chunkSize = Math.min(DEFAULT_CHUNK_SIZE, transfer.file.size - position);
  
  // Read chunk from file
  const reader = new FileReader();
  reader.onload = (e) => {
    const chunkData = e.target.result;
    
    // Send chunk to group
    const success = sendGroupFileChunk(
      transfer.groupId,
      transferId,
      chunkIndex,
      transfer.totalChunks,
      chunkSize,
      chunkData,
      transfer.senderId,
      sendMessage
    );
    
    if (success) {
      transfer.sentChunks++;
      
      // Calculate progress
      const progress = Math.floor((transfer.sentChunks / transfer.totalChunks) * 100);
      console.log(`Sent chunk ${chunkIndex + 1}/${transfer.totalChunks} for ${transfer.fileName} (${progress}%)`);
      
      // Send next chunk after a small delay
      setTimeout(() => {
        sendNextGroupChunk(transferId, sendMessage);
      }, 10);
    } else {
      console.error(`Failed to send chunk ${chunkIndex} for ${transfer.fileName}`);
      // Retry after a delay
      setTimeout(() => {
        sendNextGroupChunk(transferId, sendMessage);
      }, 1000);
    }
  };
  
  reader.readAsDataURL(transfer.file.slice(position, position + chunkSize));
}

/**
 * Get active group file transfers
 * @returns {Array} - Array of active transfers
 */
export const getActiveGroupTransfers = () => {
  const transfers = [];
  
  for (const [transferId, transfer] of activeGroupTransfers.entries()) {
    transfers.push({
      transferId,
      fileName: transfer.fileName,
      fileSize: transfer.fileSize,
      status: transfer.status,
      progress: transfer.sentChunks
        ? Math.floor((transfer.sentChunks / transfer.totalChunks) * 100)
        : Math.floor((transfer.receivedChunks / transfer.totalChunks) * 100),
      senderId: transfer.senderId,
      groupId: transfer.groupId,
      startTime: transfer.startTime
    });
  }
  
  return transfers;
};

/**
 * Cancel a group file transfer
 * @param {string} transferId - Transfer ID
 * @returns {boolean} - Success status
 */
export const cancelGroupFileTransfer = (transferId) => {
  const transfer = activeGroupTransfers.get(transferId);
  
  if (!transfer) {
    return false;
  }
  
  transfer.status = 'cancelled';
  
  // Clean up after a delay
  setTimeout(() => {
    activeGroupTransfers.delete(transferId);
  }, 5000);
  
  return true;
};

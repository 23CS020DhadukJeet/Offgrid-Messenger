/**
 * fileTransfer.js - File transfer module for IP Messenger Clone
 * 
 * This module handles file transfers between peers, including chunking large files,
 * tracking transfer progress, and reassembling received files.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getPeerById, sendToPeer } = require('./peers');
const { encryptBuffer, decryptBuffer } = require('./encryption');

// Store ongoing file transfers
const activeTransfers = new Map();

// Default chunk size for file transfers (1MB)
const DEFAULT_CHUNK_SIZE = 1024 * 1024;

// Directory to store received files
const DOWNLOAD_DIR = path.join(process.cwd(), 'downloads');

// Ensure download directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

/**
 * Generate a unique file transfer ID
 * @returns {string} - Unique ID for the file transfer
 */
function generateTransferId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Initiate sending a file to a peer
 * @param {string} filePath - Path to the file to send
 * @param {string} targetPeerId - ID of the peer to send the file to
 * @returns {Promise} - Resolves with transfer ID if successful
 */
function sendFile(filePath, targetPeerId) {
  return new Promise((resolve, reject) => {
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }
    
    // Check if the target peer exists
    const targetPeer = getPeerById(targetPeerId);
    if (!targetPeer) {
      return reject(new Error(`Target peer not found: ${targetPeerId}`));
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    
    // Generate a unique transfer ID
    const transferId = generateTransferId();
    
    // Calculate number of chunks
    const totalChunks = Math.ceil(stats.size / DEFAULT_CHUNK_SIZE);
    
    // Store transfer information
    activeTransfers.set(transferId, {
      filePath,
      fileName,
      fileSize: stats.size,
      targetPeerId,
      totalChunks,
      sentChunks: 0,
      startTime: Date.now(),
      status: 'initiating'
    });
    
    // Send file transfer request to the target peer
    const fileRequest = {
      type: 'file_request',
      transferId,
      fileName,
      fileSize: stats.size,
      totalChunks,
      timestamp: Date.now()
    };
    
    const sent = sendToPeer(targetPeerId, JSON.stringify(fileRequest));
    
    if (sent) {
      console.log(`File transfer request sent to ${targetPeerId} for ${fileName}`);
      activeTransfers.get(transferId).status = 'awaiting_acceptance';
      resolve(transferId);
    } else {
      activeTransfers.delete(transferId);
      reject(new Error(`Failed to send file transfer request to ${targetPeerId}`));
    }
  });
}

/**
 * Handle a file transfer request from a peer
 * @param {Object} request - File transfer request object
 * @param {string} senderPeerId - ID of the peer sending the file
 */
function handleFileTransferRequest(request, senderPeerId) {
  const { transferId, fileName, fileSize, totalChunks } = request;
  
  console.log(`Received file transfer request from ${senderPeerId} for ${fileName} (${fileSize} bytes)`);
  
  // Store information about the incoming transfer
  activeTransfers.set(transferId, {
    fileName,
    fileSize,
    senderPeerId,
    totalChunks,
    receivedChunks: 0,
    chunks: new Map(),
    startTime: Date.now(),
    status: 'receiving',
    outputPath: path.join(DOWNLOAD_DIR, fileName)
  });
  
  // Send acceptance response
  const response = {
    type: 'file_response',
    transferId,
    accepted: true,
    timestamp: Date.now()
  };
  
  sendToPeer(senderPeerId, JSON.stringify(response));
  
  // Emit event for UI notification
  process.emit('file-transfer-started', {
    transferId,
    fileName,
    fileSize,
    senderPeerId
  });
}

/**
 * Handle a file transfer response from a peer
 * @param {Object} response - File transfer response object
 * @param {string} receiverPeerId - ID of the peer receiving the file
 */
function handleFileTransferResponse(response, receiverPeerId) {
  const { transferId, accepted } = response;
  
  // Get the transfer information
  const transfer = activeTransfers.get(transferId);
  
  if (!transfer) {
    console.error(`Received response for unknown transfer: ${transferId}`);
    return;
  }
  
  if (accepted) {
    console.log(`File transfer accepted by ${receiverPeerId} for ${transfer.fileName}`);
    transfer.status = 'sending';
    
    // Start sending file chunks
    sendNextChunk(transferId);
  } else {
    console.log(`File transfer rejected by ${receiverPeerId} for ${transfer.fileName}`);
    transfer.status = 'rejected';
    
    // Emit event for UI notification
    process.emit('file-transfer-rejected', {
      transferId,
      fileName: transfer.fileName,
      receiverPeerId
    });
    
    // Clean up the transfer after a delay
    setTimeout(() => {
      activeTransfers.delete(transferId);
    }, 5000);
  }
}

/**
 * Send the next chunk of a file transfer
 * 
 * This function handles the chunked file transfer process:
 * 1. Checks if all chunks have been sent, and if so, completes the transfer
 * 2. Calculates the position and size of the next chunk to send
 * 3. Reads the chunk from the file
 * 4. Encrypts and sends the chunk to the recipient
 * 5. Updates progress and schedules sending the next chunk
 * 
 * The chunking approach allows large files to be sent in manageable pieces,
 * preventing memory issues and allowing for progress tracking.
 * 
 * @param {string} transferId - ID of the file transfer to process
 */
function sendNextChunk(transferId) {
  // Get the transfer object from the active transfers map
  const transfer = activeTransfers.get(transferId);
  
  // Verify the transfer exists and is in the correct state
  if (!transfer || transfer.status !== 'sending') {
    return;
  }
  
  // Check if all chunks have been sent - if so, complete the transfer
  if (transfer.sentChunks >= transfer.totalChunks) {
    console.log(`All chunks sent for ${transfer.fileName}`);
    transfer.status = 'completed';
    
    // Create and send transfer complete message to the recipient
    const completeMessage = {
      type: 'file_transfer_complete',
      transferId,
      timestamp: Date.now()
    };
    
    sendToPeer(transfer.targetPeerId, JSON.stringify(completeMessage));
    
    // Emit event for UI notification so the user knows the transfer is complete
    process.emit('file-transfer-completed', {
      transferId,
      fileName: transfer.fileName,
      fileSize: transfer.fileSize,
      targetPeerId: transfer.targetPeerId
    });
    
    // Clean up the transfer after a delay to allow for any final processing
    setTimeout(() => {
      activeTransfers.delete(transferId);
    }, 5000);
    
    return;
  }
  
  // Calculate the position and size of the next chunk to send
  // Each chunk is positioned based on its index multiplied by the chunk size
  const chunkIndex = transfer.sentChunks;
  const position = chunkIndex * DEFAULT_CHUNK_SIZE;
  // The last chunk may be smaller than the default chunk size
  const chunkSize = Math.min(DEFAULT_CHUNK_SIZE, transfer.fileSize - position);
  
  // Read the chunk from the file using a buffer
  // This is more efficient than reading the entire file into memory
  const buffer = Buffer.alloc(chunkSize);
  const fd = fs.openSync(transfer.filePath, 'r');
  fs.readSync(fd, buffer, 0, chunkSize, position);
  fs.closeSync(fd);
  
  // Encrypt the chunk for secure transmission
  const encryptedChunk = encryptBuffer(buffer);
  
  // Create a message containing the chunk data and metadata
  const chunkMessage = {
    type: 'file_chunk',
    transferId,
    chunkIndex,              // Position of this chunk in the sequence
    totalChunks: transfer.totalChunks,
    chunkSize,               // Size of this specific chunk
    data: encryptedChunk.toString('base64'), // Base64 encoded for JSON compatibility
    timestamp: Date.now()
  };
  
  // Send the chunk to the recipient peer
  const sent = sendToPeer(transfer.targetPeerId, JSON.stringify(chunkMessage));
  
  if (sent) {
    // Update the sent chunks counter
    transfer.sentChunks++;
    
    // Calculate percentage progress for UI display
    const progress = Math.floor((transfer.sentChunks / transfer.totalChunks) * 100);
    
    // Emit progress event so the UI can show a progress bar
    process.emit('file-transfer-progress', {
      transferId,
      fileName: transfer.fileName,
      progress,
      targetPeerId: transfer.targetPeerId
    });
    
    // Send the next chunk after a small delay (10ms)
    // This prevents network flooding while maintaining good throughput
    setTimeout(() => {
      sendNextChunk(transferId);
    }, 10);
  } else {
    // Handle send failure with error logging
    console.error(`Failed to send chunk ${chunkIndex} for ${transfer.fileName}`);
    
    // Retry the same chunk after a longer delay (1 second)
    // This gives time for network issues to potentially resolve
    setTimeout(() => {
      sendNextChunk(transferId);
    }, 1000);
  }
}

/**
 * Handle a file chunk received from a peer
 * 
 * This function processes incoming file chunks:
 * 1. Validates the transfer is active and in receiving state
 * 2. Decrypts the chunk data
 * 3. Stores the chunk in the correct position
 * 4. Updates progress tracking
 * 5. Checks if all chunks have been received to complete the file
 * 
 * The chunks are stored in a Map with the chunk index as the key,
 * allowing them to be reassembled in the correct order regardless
 * of the order in which they are received.
 * 
 * @param {Object} chunk - File chunk object containing chunk data and metadata
 * @param {string} senderPeerId - ID of the peer sending the chunk
 */
function handleFileChunk(chunk, senderPeerId) {
  const { transferId, chunkIndex, data } = chunk;
  
  // Get the transfer information from active transfers
  const transfer = activeTransfers.get(transferId);
  
  // Verify the transfer exists and is in receiving state
  if (!transfer || transfer.status !== 'receiving') {
    console.error(`Received chunk for unknown or inactive transfer: ${transferId}`);
    return;
  }
  
  // Decrypt the chunk data (convert from base64 string to buffer first)
  const encryptedData = Buffer.from(data, 'base64');
  const decryptedData = decryptBuffer(encryptedData);
  
  // Store the chunk in the Map using its index as the key
  // This ensures chunks can be reassembled in the correct order
  transfer.chunks.set(chunkIndex, decryptedData);
  transfer.receivedChunks++;
  
  // Calculate percentage progress for UI display
  const progress = Math.floor((transfer.receivedChunks / transfer.totalChunks) * 100);
  
  // Emit progress event so the UI can update the progress bar
  process.emit('file-transfer-progress', {
    transferId,
    fileName: transfer.fileName,
    progress,
    senderPeerId
  });
  
  // Check if all chunks have been received
  if (transfer.receivedChunks === transfer.totalChunks) {
    console.log(`All chunks received for ${transfer.fileName}`);
    // All chunks received, save the complete file to disk
    saveCompletedFile(transferId);
  }
}

/**
 * Save a completed file transfer to disk
 * 
 * This function reassembles the received file chunks and saves the complete file:
 * 1. Creates a write stream to the output file location
 * 2. Writes all chunks in sequential order
 * 3. Handles successful completion with appropriate notifications
 * 4. Handles any errors during the file saving process
 * 
 * The chunks are written in order based on their index, ensuring the file
 * is correctly reconstructed regardless of the order in which chunks were received.
 * 
 * @param {string} transferId - ID of the file transfer to save
 */
function saveCompletedFile(transferId) {
  const transfer = activeTransfers.get(transferId);
  
  // Verify the transfer exists and is in receiving state
  if (!transfer || transfer.status !== 'receiving') {
    return;
  }
  
  try {
    // Create a write stream for the output file
    // This is more efficient than writing the entire file at once
    const writeStream = fs.createWriteStream(transfer.outputPath);
    
    // Write all chunks in sequential order to reconstruct the file
    for (let i = 0; i < transfer.totalChunks; i++) {
      const chunk = transfer.chunks.get(i);
      if (chunk) {
        writeStream.write(chunk);
      } else {
        // If any chunk is missing, the file cannot be properly reconstructed
        throw new Error(`Missing chunk ${i} for file ${transfer.fileName}`);
      }
    }
    
    // Signal that all data has been written
    writeStream.end();
    
    // Handle successful file writing completion
    writeStream.on('finish', () => {
      console.log(`File saved: ${transfer.outputPath}`);
      transfer.status = 'completed';
      
      // Emit event for UI notification so the user knows the file is ready
      process.emit('file-transfer-completed', {
        transferId,
        fileName: transfer.fileName,
        filePath: transfer.outputPath,
        senderPeerId: transfer.senderPeerId
      });
      
      // Clean up the transfer data after a delay
      // This allows time for any final processing or UI updates
      setTimeout(() => {
        activeTransfers.delete(transferId);
      }, 5000);
    });
  } catch (error) {
    // Handle any errors during the file saving process
    console.error(`Error saving file ${transfer.fileName}:`, error);
    transfer.status = 'error';
    
    // Emit error event for UI notification
    process.emit('file-transfer-error', {
      transferId,
      fileName: transfer.fileName,
      error: error.message,
      senderPeerId: transfer.senderPeerId
    });
  }
}

/**
 * Get the status of all active file transfers
 * 
 * This function provides a summary of all ongoing file transfers for UI display.
 * It converts the internal transfer objects into a simplified format with:
 * - Basic file information (name, size)
 * - Current status and progress percentage
 * - Peer information and timing data
 * 
 * The progress calculation handles both sending and receiving transfers by
 * checking which counter (sentChunks or receivedChunks) is available.
 * 
 * @returns {Array} - Array of transfer status objects for UI display
 */
function getActiveTransfers() {
  const transfers = [];
  
  // Iterate through all active transfers and create status objects
  for (const [transferId, transfer] of activeTransfers.entries()) {
    transfers.push({
      transferId,
      fileName: transfer.fileName,
      fileSize: transfer.fileSize,
      status: transfer.status,
      // Calculate progress percentage based on whether this is a send or receive transfer
      progress: transfer.sentChunks
        ? Math.floor((transfer.sentChunks / transfer.totalChunks) * 100) // For sending
        : Math.floor((transfer.receivedChunks / transfer.totalChunks) * 100), // For receiving
      peerId: transfer.targetPeerId || transfer.senderPeerId, // The other peer in the transfer
      startTime: transfer.startTime // When the transfer began
    });
  }
  
  return transfers;
}

/**
 * Cancel an active file transfer
 * 
 * This function handles the cancellation of an ongoing file transfer:
 * 1. Verifies the transfer exists in the active transfers map
 * 2. Sends a cancellation message to the peer
 * 3. Updates the transfer status and emits appropriate events
 * 4. Cleans up resources associated with the transfer
 * 
 * Cancellation works for both sending and receiving transfers and
 * ensures both peers are notified about the cancellation.
 * 
 * @param {string} transferId - ID of the transfer to cancel
 * @returns {boolean} - True if the transfer was cancelled, false otherwise
 */
function cancelTransfer(transferId) {
  // Get the transfer object from active transfers
  const transfer = activeTransfers.get(transferId);
  
  // Verify the transfer exists
  if (!transfer) {
    return false;
  }
  
  // Create and send cancellation message to the peer
  const cancelMessage = {
    type: 'file_transfer_cancel',
    transferId,
    timestamp: Date.now()
  };
  
  const peerId = transfer.targetPeerId || transfer.senderPeerId;
  sendToPeer(peerId, JSON.stringify(cancelMessage));
  
  // Update transfer status
  transfer.status = 'cancelled';
  
  // Emit event for UI notification
  process.emit('file-transfer-cancelled', {
    transferId,
    fileName: transfer.fileName,
    peerId
  });
  
  // Clean up the transfer after a delay
  setTimeout(() => {
    activeTransfers.delete(transferId);
  }, 5000);
  
  return true;
}

/**
 * Handle a file transfer cancellation from a peer
 * 
 * This function processes cancellation requests received from other peers:
 * 1. Extracts the transfer ID from the cancellation message
 * 2. Verifies the transfer exists in the active transfers map
 * 3. Logs the cancellation event for debugging purposes
 * 4. Updates the transfer status to 'cancelled'
 * 5. Emits an event to notify the UI about the cancellation
 * 6. Schedules cleanup of transfer resources after a short delay
 * 
 * The cancellation process ensures both peers have consistent state
 * and that the UI is properly updated to reflect the cancellation.
 * 
 * @param {Object} message - Cancellation message object containing transferId
 * @param {string} peerId - ID of the peer cancelling the transfer
 */
function handleTransferCancel(message, peerId) {
  // Extract transfer ID from the message
  const { transferId } = message;
  
  // Get the transfer object from active transfers
  const transfer = activeTransfers.get(transferId);
  
  // Verify the transfer exists
  if (!transfer) {
    return;
  }
  
  // Log cancellation for debugging
  console.log(`File transfer cancelled by peer ${peerId} for ${transfer.fileName}`);
  
  // Update transfer status to cancelled
  transfer.status = 'cancelled';
  
  // Emit event for UI notification so user is aware of cancellation
  process.emit('file-transfer-cancelled', {
    transferId,
    fileName: transfer.fileName,
    peerId
  });
  
  // Clean up the transfer after a delay to allow for UI updates
  setTimeout(() => {
    activeTransfers.delete(transferId);
  }, 5000);
}

/**
 * Export all file transfer related functions for use in other modules
 * 
 * This module provides a complete file transfer system with the following capabilities:
 * - Initiating file transfers to peers (sendFile)
 * - Handling incoming file transfer requests (handleFileTransferRequest)
 * - Processing responses to file transfer requests (handleFileTransferResponse)
 * - Managing chunked file data transfer (handleFileChunk)
 * - Supporting transfer cancellation (handleTransferCancel, cancelTransfer)
 * - Providing transfer status information (getActiveTransfers)
 * 
 * The system handles encryption, chunking, progress tracking, and reassembly
 * to provide secure and reliable file transfers between peers.
 */
module.exports = {
  sendFile,               // Initiate sending a file to a peer
  handleFileTransferRequest,    // Process incoming file transfer requests
  handleFileTransferResponse,   // Handle responses to our file transfer requests
  handleFileChunk,        // Process incoming file chunks during transfer
  handleTransferCancel,   // Handle cancellation requests from peers
  getActiveTransfers,     // Get status information for all active transfers
  cancelTransfer          // Cancel an ongoing file transfer
};
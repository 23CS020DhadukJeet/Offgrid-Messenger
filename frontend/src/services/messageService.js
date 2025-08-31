/**
 * messageService.js - Service for handling messaging operations
 * 
 * This service provides functions for creating, sending, receiving, and formatting messages.
 * It handles the core messaging functionality of the application, including:
 * - Creating standardized message objects with metadata
 * - Sending messages to peers through the Electron IPC bridge
 * - Formatting message timestamps for display in the UI
 * - Organizing messages into chronological groups for display
 */

/**
 * Creates a new standardized message object with all required metadata
 * 
 * This function generates a complete message object with:
 * - Unique ID based on current timestamp
 * - Message content
 * - Sender and receiver identifiers
 * - Message type (defaults to 'text')
 * - Creation timestamp
 * - Initial status ('sent')
 * 
 * @param {string} content - The message content/body
 * @param {string} senderId - ID of the message sender (usually 'me' for current user)
 * @param {string} receiverId - ID of the message recipient
 * @param {string} type - Message type, defaults to 'text' (can be 'text', 'file', etc.)
 * @returns {Object} A complete message object ready for sending or storing
 */
const createMessage = (content, senderId, receiverId, type = 'text') => {
  return {
    id: Date.now().toString(),
    content,
    senderId,
    receiverId,
    type,
    timestamp: Date.now(),
    status: 'sent'
  };
};

/**
 * Sends a message to a specific peer through the Electron IPC bridge
 * 
 * This function creates a message object and sends it to the specified peer.
 * It works only in the Electron environment where the IPC bridge is available.
 * The function handles error cases and returns the created message on success.
 * 
 * @param {string} peerId - ID of the peer to send the message to
 * @param {string} content - The message content/body
 * @param {string} type - Message type, defaults to 'text'
 * @returns {Object|null} The created message object if sent successfully, null otherwise
 */
const sendMessageToPeer = async (peerId, content, type = 'text') => {
  if (!peerId || !content) return null;
  
  if (window.electron) {
    try {
      const message = createMessage(content, 'me', peerId, type);
      
      await window.electron.sendMessage({
        peerId,
        content,
        type
      });
      
      return message;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }
  
  return null;
};

/**
 * Formats a message timestamp for display in the UI
 * 
 * This function converts a Unix timestamp into a human-readable format based on recency:
 * - Messages from today: Show only time (HH:MM)
 * - Messages from this week: Show day name and time (Mon HH:MM)
 * - Older messages: Show full date and time (MM/DD/YYYY HH:MM)
 * 
 * This creates a more natural reading experience in the chat interface.
 * 
 * @param {number} timestamp - Unix timestamp (milliseconds since epoch)
 * @param {Date} [now=new Date()] - Current date/time (for testing)
 * @returns {string} Formatted timestamp string for display
 */
const formatMessageTime = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  
  // If the message is from today, show only the time
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // If the message is from this week, show the day and time
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' }) + ' ' + 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Otherwise, show the full date
  return date.toLocaleDateString() + ' ' + 
         date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Groups an array of messages by their date for display in the UI
 * 
 * This function organizes messages into chronological groups based on the date
 * they were sent. Each group contains a date string and an array of messages
 * from that date. This is useful for displaying date separators in chat interfaces.
 * 
 * The function preserves the original order of messages within each date group.
 * 
 * @param {Array<Object>} messages - Array of message objects with timestamp property
 * @returns {Array<Object>} Array of date groups, each containing a date string and messages array
 */
const groupMessagesByDate = (messages) => {
  const groups = [];
  let currentDate = null;
  let currentGroup = null;
  
  messages.forEach(message => {
    const messageDate = new Date(message.timestamp).toDateString();
    
    if (messageDate !== currentDate) {
      currentDate = messageDate;
      currentGroup = {
        date: messageDate,
        messages: []
      };
      groups.push(currentGroup);
    }
    
    currentGroup.messages.push(message);
  });
  
  return groups;
};

/**
 * Export the message service API
 * 
 * These functions provide the public interface for the message service:
 * - createMessage: Generate standardized message objects
 * - sendMessageToPeer: Send messages to specific peers
 * - formatMessageTime: Format timestamps for UI display
 * - groupMessagesByDate: Organize messages into date-based groups
 */
export {
  createMessage,
  sendMessageToPeer,
  formatMessageTime,
  groupMessagesByDate
};
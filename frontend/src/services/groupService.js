/**
 * groupService.js - Service for handling group operations
 * 
 * This service provides functions for creating, managing, and messaging in groups.
 * It handles the core group functionality of the application, including:
 * - Creating and managing groups
 * - Adding/removing group members
 * - Sending group messages
 * - Managing group file transfers
 */

const API_BASE_URL = 'http://localhost:8080/api';

/**
 * Create a new group
 * @param {string} groupName - Name of the group
 * @param {string} creatorId - ID of the user creating the group
 * @param {Array<string>} memberIds - Array of member IDs to add to the group
 * @returns {Promise<Object>} - Group object or error
 */
export const createGroup = async (groupName, creatorId, memberIds = []) => {
  try {
    const response = await fetch(`${API_BASE_URL}/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        groupName,
        creatorId,
        memberIds
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to create group');
    }
    
    return data;
  } catch (error) {
    console.error('Error creating group:', error);
    throw error;
  }
};

/**
 * Get all groups for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of groups
 */
export const getUserGroups = async (userId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/groups?userId=${userId}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get user groups');
    }
    
    return data.groups || [];
  } catch (error) {
    console.error('Error getting user groups:', error);
    throw error;
  }
};

/**
 * Get specific group by ID
 * @param {string} groupId - Group ID
 * @returns {Promise<Object>} - Group object or null
 */
export const getGroup = async (groupId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/groups/${groupId}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get group');
    }
    
    return data.group;
  } catch (error) {
    console.error('Error getting group:', error);
    throw error;
  }
};

/**
 * Add member to group
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID to add
 * @param {string} addedBy - User ID of who is adding the member
 * @returns {Promise<boolean>} - Success status
 */
export const addMemberToGroup = async (groupId, userId, addedBy) => {
  try {
    const response = await fetch(`${API_BASE_URL}/groups/${groupId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        addedBy
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to add member to group');
    }
    
    return data.success;
  } catch (error) {
    console.error('Error adding member to group:', error);
    throw error;
  }
};

/**
 * Remove member from group
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID to remove
 * @param {string} removedBy - User ID of who is removing the member
 * @returns {Promise<boolean>} - Success status
 */
export const removeMemberFromGroup = async (groupId, userId, removedBy) => {
  try {
    const response = await fetch(`${API_BASE_URL}/groups/${groupId}/members`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        removedBy
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to remove member from group');
    }
    
    return data.success;
  } catch (error) {
    console.error('Error removing member from group:', error);
    throw error;
  }
};

/**
 * Get group messages
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID requesting messages
 * @param {number} limit - Maximum number of messages to return
 * @returns {Promise<Array>} - Array of messages
 */
export const getGroupMessages = async (groupId, userId, limit = 100) => {
  try {
    const response = await fetch(`${API_BASE_URL}/groups/${groupId}/messages?userId=${userId}&limit=${limit}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get group messages');
    }
    
    return data.messages || [];
  } catch (error) {
    console.error('Error getting group messages:', error);
    throw error;
  }
};

/**
 * Get group file transfers
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID requesting files
 * @returns {Promise<Array>} - Array of file transfers
 */
export const getGroupFileTransfers = async (groupId, userId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/groups/${groupId}/files?userId=${userId}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get group file transfers');
    }
    
    return data.files || [];
  } catch (error) {
    console.error('Error getting group file transfers:', error);
    throw error;
  }
};

/**
 * Delete group
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID requesting deletion
 * @returns {Promise<boolean>} - Success status
 */
export const deleteGroup = async (groupId, userId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/groups/${groupId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete group');
    }
    
    return data.success;
  } catch (error) {
    console.error('Error deleting group:', error);
    throw error;
  }
};

/**
 * Send group message via WebSocket
 * @param {string} groupId - Group ID
 * @param {string} content - Message content
 * @param {string} senderId - Sender ID
 * @param {Function} sendMessage - WebSocket send function
 * @returns {boolean} - Success status
 */
export const sendGroupMessage = (groupId, content, senderId, sendMessage) => {
  try {
    const message = {
      type: 'group_chat',
      groupId,
      content,
      senderId,
      timestamp: Date.now()
    };
    
    return sendMessage(message);
  } catch (error) {
    console.error('Error sending group message:', error);
    return false;
  }
};

/**
 * Send group file request via WebSocket
 * @param {string} groupId - Group ID
 * @param {string} transferId - Transfer ID
 * @param {string} fileName - File name
 * @param {number} fileSize - File size
 * @param {string} senderId - Sender ID
 * @param {Function} sendMessage - WebSocket send function
 * @returns {boolean} - Success status
 */
export const sendGroupFileRequest = (groupId, transferId, fileName, fileSize, senderId, sendMessage) => {
  try {
    const message = {
      type: 'group_file_request',
      groupId,
      transferId,
      fileName,
      fileSize,
      senderId,
      timestamp: Date.now()
    };
    
    return sendMessage(message);
  } catch (error) {
    console.error('Error sending group file request:', error);
    return false;
  }
};

/**
 * Send group file chunk via WebSocket
 * @param {string} groupId - Group ID
 * @param {string} transferId - Transfer ID
 * @param {number} chunkIndex - Chunk index
 * @param {number} totalChunks - Total chunks
 * @param {number} chunkSize - Chunk size
 * @param {string} data - Chunk data (base64)
 * @param {string} senderId - Sender ID
 * @param {Function} sendMessage - WebSocket send function
 * @returns {boolean} - Success status
 */
export const sendGroupFileChunk = (groupId, transferId, chunkIndex, totalChunks, chunkSize, data, senderId, sendMessage) => {
  try {
    const message = {
      type: 'group_file_chunk',
      groupId,
      transferId,
      chunkIndex,
      totalChunks,
      chunkSize,
      data,
      senderId,
      timestamp: Date.now()
    };
    
    return sendMessage(message);
  } catch (error) {
    console.error('Error sending group file chunk:', error);
    return false;
  }
};

/**
 * Send group file complete via WebSocket
 * @param {string} groupId - Group ID
 * @param {string} transferId - Transfer ID
 * @param {string} senderId - Sender ID
 * @param {Function} sendMessage - WebSocket send function
 * @returns {boolean} - Success status
 */
export const sendGroupFileComplete = (groupId, transferId, senderId, sendMessage) => {
  try {
    const message = {
      type: 'group_file_complete',
      groupId,
      transferId,
      senderId,
      timestamp: Date.now()
    };
    
    return sendMessage(message);
  } catch (error) {
    console.error('Error sending group file complete:', error);
    return false;
  }
};

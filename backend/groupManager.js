/**
 * groupManager.js - Group management module for IP Messenger Clone
 * 
 * This module handles group creation, management, and messaging functionality.
 * It provides APIs for creating groups, adding/removing members, and managing
 * group-specific messaging and file sharing.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Store active groups
const groups = new Map();

// Store group messages
const groupMessages = new Map();

// Store group file transfers
const groupFileTransfers = new Map();

// Directory to store group files
const GROUP_FILES_DIR = path.join(process.cwd(), 'downloads', 'groups');

// Ensure group files directory exists
if (!fs.existsSync(GROUP_FILES_DIR)) {
  fs.mkdirSync(GROUP_FILES_DIR, { recursive: true });
}

/**
 * Generate a unique group ID
 * @returns {string} - Unique ID for the group
 */
function generateGroupId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Create a new group
 * @param {string} groupName - Name of the group
 * @param {string} creatorId - ID of the user creating the group
 * @param {Array<string>} memberIds - Array of member IDs to add to the group
 * @returns {Object} - Group object with ID and details
 */
function createGroup(groupName, creatorId, memberIds = []) {
  const groupId = generateGroupId();
  const group = {
    id: groupId,
    name: groupName,
    creator: creatorId,
    members: [creatorId, ...memberIds],
    createdAt: Date.now(),
    lastActivity: Date.now()
  };
  
  groups.set(groupId, group);
  groupMessages.set(groupId, []);
  groupFileTransfers.set(groupId, new Map());
  
  console.log(`Group created: ${groupName} (${groupId}) by ${creatorId}`);
  return group;
}

/**
 * Get group by ID
 * @param {string} groupId - Group ID
 * @returns {Object|null} - Group object or null if not found
 */
function getGroup(groupId) {
  return groups.get(groupId) || null;
}

/**
 * Get all groups for a user
 * @param {string} userId - User ID
 * @returns {Array} - Array of groups the user is a member of
 */
function getUserGroups(userId) {
  const userGroups = [];
  for (const group of groups.values()) {
    if (group.members.includes(userId)) {
      userGroups.push(group);
    }
  }
  return userGroups;
}

/**
 * Add member to group
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID to add
 * @param {string} addedBy - User ID of who is adding the member
 * @returns {boolean} - True if successful, false otherwise
 */
function addMemberToGroup(groupId, userId, addedBy) {
  const group = groups.get(groupId);
  if (!group) {
    return false;
  }
  
  // Check if the user adding is a member of the group
  if (!group.members.includes(addedBy)) {
    return false;
  }
  
  // Add user if not already a member
  if (!group.members.includes(userId)) {
    group.members.push(userId);
    group.lastActivity = Date.now();
    console.log(`User ${userId} added to group ${group.name} by ${addedBy}`);
    return true;
  }
  
  return true; // Already a member
}

/**
 * Remove member from group
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID to remove
 * @param {string} removedBy - User ID of who is removing the member
 * @returns {boolean} - True if successful, false otherwise
 */
function removeMemberFromGroup(groupId, userId, removedBy) {
  const group = groups.get(groupId);
  if (!group) {
    return false;
  }
  
  // Check if the user removing is a member of the group
  if (!group.members.includes(removedBy)) {
    return false;
  }
  
  // Cannot remove the creator
  if (userId === group.creator) {
    return false;
  }
  
  // Remove user if they are a member
  const memberIndex = group.members.indexOf(userId);
  if (memberIndex > -1) {
    group.members.splice(memberIndex, 1);
    group.lastActivity = Date.now();
    console.log(`User ${userId} removed from group ${group.name} by ${removedBy}`);
    return true;
  }
  
  return false;
}

/**
 * Check if user is member of group
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID
 * @returns {boolean} - True if user is a member
 */
function isGroupMember(groupId, userId) {
  const group = groups.get(groupId);
  return group ? group.members.includes(userId) : false;
}

/**
 * Add message to group
 * @param {string} groupId - Group ID
 * @param {Object} message - Message object
 * @returns {boolean} - True if successful
 */
function addGroupMessage(groupId, message) {
  const group = groups.get(groupId);
  if (!group) {
    return false;
  }
  
  // Check if sender is a member
  if (!group.members.includes(message.senderId)) {
    return false;
  }
  
  const messages = groupMessages.get(groupId) || [];
  messages.push({
    ...message,
    id: message.id || crypto.randomBytes(8).toString('hex'),
    timestamp: message.timestamp || Date.now()
  });
  
  groupMessages.set(groupId, messages);
  group.lastActivity = Date.now();
  
  return true;
}

/**
 * Get group messages
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID requesting messages
 * @param {number} limit - Maximum number of messages to return
 * @returns {Array} - Array of messages or empty array if not authorized
 */
function getGroupMessages(groupId, userId, limit = 100) {
  const group = groups.get(groupId);
  if (!group || !group.members.includes(userId)) {
    return [];
  }
  
  const messages = groupMessages.get(groupId) || [];
  return messages.slice(-limit);
}

/**
 * Add file transfer to group
 * @param {string} groupId - Group ID
 * @param {Object} fileTransfer - File transfer object
 * @returns {boolean} - True if successful
 */
function addGroupFileTransfer(groupId, fileTransfer) {
  const group = groups.get(groupId);
  if (!group) {
    return false;
  }
  
  // Check if sender is a member
  if (!group.members.includes(fileTransfer.senderId)) {
    return false;
  }
  
  const transfers = groupFileTransfers.get(groupId) || new Map();
  transfers.set(fileTransfer.transferId, fileTransfer);
  groupFileTransfers.set(groupId, transfers);
  
  return true;
}

/**
 * Get group file transfers
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID requesting transfers
 * @returns {Array} - Array of file transfers or empty array if not authorized
 */
function getGroupFileTransfers(groupId, userId) {
  const group = groups.get(groupId);
  if (!group || !group.members.includes(userId)) {
    return [];
  }
  
  const transfers = groupFileTransfers.get(groupId) || new Map();
  return Array.from(transfers.values());
}

/**
 * Delete group
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID requesting deletion
 * @returns {boolean} - True if successful
 */
function deleteGroup(groupId, userId) {
  const group = groups.get(groupId);
  if (!group || group.creator !== userId) {
    return false;
  }
  
  groups.delete(groupId);
  groupMessages.delete(groupId);
  groupFileTransfers.delete(groupId);
  
  console.log(`Group ${group.name} deleted by ${userId}`);
  return true;
}

/**
 * Get group file path
 * @param {string} groupId - Group ID
 * @param {string} fileName - File name
 * @returns {string} - Full path to group file
 */
function getGroupFilePath(groupId, fileName) {
  const groupDir = path.join(GROUP_FILES_DIR, groupId);
  if (!fs.existsSync(groupDir)) {
    fs.mkdirSync(groupDir, { recursive: true });
  }
  return path.join(groupDir, fileName);
}

/**
 * Broadcast message to all group members
 * @param {string} groupId - Group ID
 * @param {Object} message - Message to broadcast
 * @param {Function} sendToPeer - Function to send message to peer
 * @returns {Array} - Array of peer IDs that received the message
 */
function broadcastToGroupMembers(groupId, message, sendToPeer) {
  const group = groups.get(groupId);
  if (!group) {
    return [];
  }
  
  const sentTo = [];
  for (const memberId of group.members) {
    if (sendToPeer(memberId, JSON.stringify(message))) {
      sentTo.push(memberId);
    }
  }
  
  return sentTo;
}

module.exports = {
  createGroup,
  getGroup,
  getUserGroups,
  addMemberToGroup,
  removeMemberFromGroup,
  isGroupMember,
  addGroupMessage,
  getGroupMessages,
  addGroupFileTransfer,
  getGroupFileTransfers,
  deleteGroup,
  getGroupFilePath,
  broadcastToGroupMembers
};

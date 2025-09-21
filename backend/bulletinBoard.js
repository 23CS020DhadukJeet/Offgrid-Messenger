/**
 * bulletinBoard.js - Bulletin board module for IP Messenger Clone
 * 
 * This module handles bulletin board functionality, allowing users to post
 * announcements that can be either general (visible to everyone) or
 * group-specific (visible only to group members). Announcements can also
 * have different priority levels.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Store announcements
const generalAnnouncements = new Map();
const groupAnnouncements = new Map();

/**
 * Generate a unique announcement ID
 * @returns {string} - Unique ID for the announcement
 */
function generateAnnouncementId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Create a general announcement visible to all users
 * @param {string} title - Title of the announcement
 * @param {string} content - Content of the announcement
 * @param {string} authorId - ID of the user creating the announcement
 * @param {string} priority - Priority level of the announcement (low, medium, high)
 * @returns {Object} - Announcement object with ID and details
 */
function createGeneralAnnouncement(title, content, authorId, priority = 'medium') {
  const announcementId = generateAnnouncementId();
  const announcement = {
    id: announcementId,
    title,
    content,
    authorId,
    priority,
    isGeneral: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  generalAnnouncements.set(announcementId, announcement);
  console.log(`General announcement created: ${title} (${announcementId}) by ${authorId}`);
  return announcement;
}

/**
 * Create a group-specific announcement visible only to group members
 * @param {string} title - Title of the announcement
 * @param {string} content - Content of the announcement
 * @param {string} authorId - ID of the user creating the announcement
 * @param {string} groupId - ID of the group the announcement belongs to
 * @param {string} priority - Priority level of the announcement (low, medium, high)
 * @returns {Object} - Announcement object with ID and details
 */
function createGroupAnnouncement(title, content, authorId, groupId, priority = 'medium') {
  const announcementId = generateAnnouncementId();
  const announcement = {
    id: announcementId,
    title,
    content,
    authorId,
    groupId,
    priority,
    isGeneral: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  // Initialize group announcements map if it doesn't exist
  if (!groupAnnouncements.has(groupId)) {
    groupAnnouncements.set(groupId, new Map());
  }
  
  groupAnnouncements.get(groupId).set(announcementId, announcement);
  console.log(`Group announcement created: ${title} (${announcementId}) for group ${groupId} by ${authorId}`);
  return announcement;
}

/**
 * Get all general announcements
 * @returns {Array} - Array of general announcements
 */
function getGeneralAnnouncements() {
  return Array.from(generalAnnouncements.values()).sort((a, b) => {
    // Sort by priority first (high > medium > low)
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then sort by creation date (newest first)
    return b.createdAt - a.createdAt;
  });
}

/**
 * Get all announcements for a specific group
 * @param {string} groupId - Group ID
 * @returns {Array} - Array of group announcements
 */
function getGroupAnnouncements(groupId) {
  if (!groupAnnouncements.has(groupId)) {
    return [];
  }
  
  return Array.from(groupAnnouncements.get(groupId).values()).sort((a, b) => {
    // Sort by priority first (high > medium > low)
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then sort by creation date (newest first)
    return b.createdAt - a.createdAt;
  });
}

/**
 * Get a specific announcement by ID
 * @param {string} announcementId - Announcement ID
 * @param {string} [groupId] - Optional group ID for group announcements
 * @returns {Object|null} - Announcement object or null if not found
 */
function getAnnouncement(announcementId, groupId = null) {
  // Check general announcements first
  if (generalAnnouncements.has(announcementId)) {
    return generalAnnouncements.get(announcementId);
  }
  
  // If groupId is provided, check group announcements
  if (groupId && groupAnnouncements.has(groupId)) {
    return groupAnnouncements.get(groupId).get(announcementId) || null;
  }
  
  // If groupId is not provided, search all group announcements
  if (!groupId) {
    for (const groupAnnouncementsMap of groupAnnouncements.values()) {
      if (groupAnnouncementsMap.has(announcementId)) {
        return groupAnnouncementsMap.get(announcementId);
      }
    }
  }
  
  return null;
}

/**
 * Update an announcement
 * @param {string} announcementId - Announcement ID
 * @param {Object} updates - Object containing fields to update
 * @param {string} [groupId] - Optional group ID for group announcements
 * @returns {Object|null} - Updated announcement or null if not found
 */
function updateAnnouncement(announcementId, updates, groupId = null) {
  const announcement = getAnnouncement(announcementId, groupId);
  if (!announcement) {
    return null;
  }
  
  // Apply updates
  const updatedAnnouncement = {
    ...announcement,
    ...updates,
    updatedAt: Date.now()
  };
  
  // Update in the appropriate map
  if (announcement.isGeneral) {
    generalAnnouncements.set(announcementId, updatedAnnouncement);
  } else {
    groupAnnouncements.get(announcement.groupId).set(announcementId, updatedAnnouncement);
  }
  
  return updatedAnnouncement;
}

/**
 * Delete an announcement
 * @param {string} announcementId - Announcement ID
 * @param {string} [groupId] - Optional group ID for group announcements
 * @returns {boolean} - True if successful, false otherwise
 */
function deleteAnnouncement(announcementId, groupId = null) {
  const announcement = getAnnouncement(announcementId, groupId);
  if (!announcement) {
    return false;
  }
  
  if (announcement.isGeneral) {
    return generalAnnouncements.delete(announcementId);
  } else {
    return groupAnnouncements.get(announcement.groupId).delete(announcementId);
  }
}

/**
 * Get all announcements visible to a user (general + user's groups)
 * @param {string} userId - User ID
 * @param {Array<string>} userGroupIds - Array of group IDs the user is a member of
 * @returns {Array} - Array of announcements visible to the user
 */
function getUserVisibleAnnouncements(userId, userGroupIds) {
  // Get general announcements
  const visibleAnnouncements = getGeneralAnnouncements();
  
  // Get group announcements for user's groups
  for (const groupId of userGroupIds) {
    const groupAnns = getGroupAnnouncements(groupId);
    visibleAnnouncements.push(...groupAnns);
  }
  
  // Sort by priority and date
  return visibleAnnouncements.sort((a, b) => {
    // Sort by priority first (high > medium > low)
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then sort by creation date (newest first)
    return b.createdAt - a.createdAt;
  });
}

module.exports = {
  createGeneralAnnouncement,
  createGroupAnnouncement,
  getGeneralAnnouncements,
  getGroupAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getUserVisibleAnnouncements
};
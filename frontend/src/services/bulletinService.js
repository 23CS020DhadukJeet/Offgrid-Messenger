/**
 * bulletinService.js - Service for handling bulletin board operations
 * 
 * This service provides functions for creating, retrieving, updating, and deleting
 * announcements on the bulletin board, both general and group-specific.
 */

import { getCurrentUser } from './authService';
import { sendMessage } from './websocketService';

const API_BASE_URL = 'http://localhost:8080/api';

/**
 * Create a general announcement
 * @param {string} title - Title of the announcement
 * @param {string} content - Content of the announcement
 * @param {string} priority - Priority level (low, medium, high)
 * @returns {Promise<Object>} - Created announcement
 */
export const createGeneralAnnouncement = async (title, content, priority = 'medium') => {
  try {
    const user = getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    
    const response = await fetch(`${API_BASE_URL}/bulletins/general`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        content,
        authorId: user.id,
        priority
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to create announcement');
    }
    
    // Also send via WebSocket for real-time updates
    sendMessage({
      type: 'general_announcement',
      title,
      content,
      priority,
      from: user.id
    });
    
    return data.announcement;
  } catch (error) {
    console.error('Error creating general announcement:', error);
    throw error;
  }
};

/**
 * Create a group-specific announcement
 * @param {string} groupId - ID of the group
 * @param {string} title - Title of the announcement
 * @param {string} content - Content of the announcement
 * @param {string} priority - Priority level (low, medium, high)
 * @returns {Promise<Object>} - Created announcement
 */
export const createGroupAnnouncement = async (groupId, title, content, priority = 'medium') => {
  try {
    const user = getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    
    const response = await fetch(`${API_BASE_URL}/bulletins/group`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        content,
        authorId: user.id,
        groupId,
        priority
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to create group announcement');
    }
    
    // Also send via WebSocket for real-time updates
    sendMessage({
      type: 'group_announcement',
      groupId,
      title,
      content,
      priority,
      from: user.id
    });
    
    return data.announcement;
  } catch (error) {
    console.error('Error creating group announcement:', error);
    throw error;
  }
};

/**
 * Get all general announcements
 * @returns {Promise<Array>} - Array of general announcements
 */
export const getGeneralAnnouncements = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/bulletins/general`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get announcements');
    }
    
    return data.announcements || [];
  } catch (error) {
    console.error('Error getting general announcements:', error);
    throw error;
  }
};

/**
 * Get all announcements for a specific group
 * @param {string} groupId - Group ID
 * @returns {Promise<Array>} - Array of group announcements
 */
export const getGroupAnnouncements = async (groupId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/bulletins/group/${groupId}/announcements`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get group announcements');
    }
    
    return data.announcements || [];
  } catch (error) {
    console.error('Error getting group announcements:', error);
    throw error;
  }
};

/**
 * Get all announcements visible to the current user
 * @param {Array<string>} groupIds - Array of group IDs the user is a member of
 * @returns {Promise<Array>} - Array of announcements visible to the user
 */
export const getUserVisibleAnnouncements = async (groupIds = []) => {
  try {
    const user = getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    
    const groupIdsParam = groupIds.length > 0 ? `&groupIds=${groupIds.join(',')}` : '';
    const response = await fetch(`${API_BASE_URL}/bulletins/user?userId=${user.id}${groupIdsParam}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get user announcements');
    }
    
    return data.announcements || [];
  } catch (error) {
    console.error('Error getting user visible announcements:', error);
    throw error;
  }
};

/**
 * Update an announcement
 * @param {string} announcementId - Announcement ID
 * @param {Object} updates - Object containing fields to update
 * @param {string} [groupId] - Optional group ID for group announcements
 * @returns {Promise<Object>} - Updated announcement
 */
export const updateAnnouncement = async (announcementId, updates, groupId = null) => {
  try {
    const user = getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    
    let url;
    if (groupId) {
      url = `${API_BASE_URL}/bulletins/group/${groupId}/announcements/${announcementId}`;
    } else {
      url = `${API_BASE_URL}/bulletins/general/${announcementId}`;
    }
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update announcement');
    }
    
    return data.announcement;
  } catch (error) {
    console.error('Error updating announcement:', error);
    throw error;
  }
};

/**
 * Delete an announcement
 * @param {string} announcementId - Announcement ID
 * @param {string} [groupId] - Optional group ID for group announcements
 * @returns {Promise<boolean>} - Success status
 */
export const deleteAnnouncement = async (announcementId, groupId = null) => {
  try {
    const user = getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    
    let url;
    if (groupId) {
      url = `${API_BASE_URL}/bulletins/group/${groupId}/announcements/${announcementId}`;
    } else {
      url = `${API_BASE_URL}/bulletins/general/${announcementId}`;
    }
    
    const response = await fetch(url, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete announcement');
    }
    
    return data.success;
  } catch (error) {
    console.error('Error deleting announcement:', error);
    throw error;
  }
};
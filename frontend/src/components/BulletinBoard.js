/**
 * BulletinBoard.js - Component for displaying bulletin board announcements
 * 
 * This component displays both general and group-specific announcements,
 * with filtering options and priority indicators.
 */

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Tabs, 
  Tab, 
  Divider, 
  List, 
  ListItem, 
  ListItemText, 
  Chip, 
  IconButton, 
  Button,
  Tooltip
} from '@mui/material';
import { 
  Announcement as AnnouncementIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Add as AddIcon, 
  Warning as WarningIcon, 
  Info as InfoIcon, 
  Flag as FlagIcon
} from '@mui/icons-material';

import { 
  getGeneralAnnouncements, 
  getGroupAnnouncements, 
  getUserVisibleAnnouncements, 
  createGeneralAnnouncement, 
  createGroupAnnouncement, 
  updateAnnouncement, 
  deleteAnnouncement 
} from '../services/bulletinService';

import BulletinBoardDialog from './BulletinBoardDialog';

// Priority colors
const priorityColors = {
  low: '#8bc34a',    // Light green
  medium: '#ff9800', // Orange
  high: '#f44336'    // Red
};

// Priority icons
const PriorityIcon = ({ priority }) => {
  switch (priority) {
    case 'high':
      return <WarningIcon style={{ color: priorityColors.high }} />;
    case 'medium':
      return <FlagIcon style={{ color: priorityColors.medium }} />;
    case 'low':
      return <InfoIcon style={{ color: priorityColors.low }} />;
    default:
      return <InfoIcon style={{ color: priorityColors.low }} />;
  }
};

// Announcement item component
const AnnouncementItem = ({ announcement, onEdit, onDelete, isCreator }) => {
  const { id, title, content, priority, authorId, createdAt, isGeneral, groupId } = announcement;
  
  return (
    <Paper elevation={2} sx={{ mb: 2, p: 2, position: 'relative' }}>
      <Box display="flex" alignItems="center" mb={1}>
        <PriorityIcon priority={priority} />
        <Typography variant="h6" ml={1}>
          {title}
        </Typography>
        <Chip 
          label={priority.toUpperCase()} 
          size="small" 
          sx={{ 
            ml: 2, 
            backgroundColor: priorityColors[priority],
            color: 'white'
          }} 
        />
      </Box>
      
      <Typography variant="body1" paragraph>
        {content}
      </Typography>
      
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="caption" color="text.secondary">
          {new Date(createdAt).toLocaleString()}
        </Typography>
        
        {isCreator && (
          <Box>
            <IconButton size="small" onClick={() => onEdit(announcement)}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => onDelete(id, groupId)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

// Main BulletinBoard component
const BulletinBoard = ({ userId, userGroups = [], selectedGroup = null }) => {
  // State for announcements
  const [generalAnnouncements, setGeneralAnnouncements] = useState([]);
  const [groupAnnouncements, setGroupAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State for tabs
  const [tabValue, setTabValue] = useState(selectedGroup ? 1 : 0);
  
  // State for announcement dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [formValues, setFormValues] = useState({
    title: '',
    content: '',
    priority: 'medium',
    isGeneral: true,
    groupId: selectedGroup?.id || ''
  });
  
  // Fetch announcements on component mount and when dependencies change
  useEffect(() => {
    const fetchAnnouncements = async () => {
      setLoading(true);
      try {
        // Fetch general announcements
        const generalAnns = await getGeneralAnnouncements();
        setGeneralAnnouncements(generalAnns);
        
        // Fetch group announcements if a group is selected
        if (selectedGroup) {
          const groupAnns = await getGroupAnnouncements(selectedGroup.id);
          setGroupAnnouncements(groupAnns);
        } else {
          setGroupAnnouncements([]);
        }
      } catch (error) {
        console.error('Error fetching announcements:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnnouncements();
  }, [selectedGroup]);
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Handle dialog open for creating a new announcement
  const handleNewAnnouncement = (isGeneral = true) => {
    setEditingAnnouncement(null);
    setFormValues({
      title: '',
      content: '',
      priority: 'medium',
      isGeneral,
      groupId: selectedGroup?.id || ''
    });
    setDialogOpen(true);
  };
  
  // Handle dialog open for editing an announcement
  const handleEditAnnouncement = (announcement) => {
    setEditingAnnouncement(announcement);
    setFormValues({
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      isGeneral: announcement.isGeneral,
      groupId: announcement.groupId || ''
    });
    setDialogOpen(true);
  };
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    try {
      const { title, content, priority, isGeneral, groupId } = formValues;
      
      if (editingAnnouncement) {
        // Update existing announcement
        const updatedAnnouncement = await updateAnnouncement(
          editingAnnouncement.id,
          { title, content, priority },
          editingAnnouncement.isGeneral ? null : editingAnnouncement.groupId
        );
        
        // Update state
        if (updatedAnnouncement.isGeneral) {
          setGeneralAnnouncements(prev => 
            prev.map(a => a.id === updatedAnnouncement.id ? updatedAnnouncement : a)
          );
        } else {
          setGroupAnnouncements(prev => 
            prev.map(a => a.id === updatedAnnouncement.id ? updatedAnnouncement : a)
          );
        }
      } else {
        // Create new announcement
        if (isGeneral) {
          const newAnnouncement = await createGeneralAnnouncement(title, content, priority);
          setGeneralAnnouncements(prev => [newAnnouncement, ...prev]);
        } else {
          const newAnnouncement = await createGroupAnnouncement(groupId, title, content, priority);
          setGroupAnnouncements(prev => [newAnnouncement, ...prev]);
        }
      }
      
      // Close dialog
      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving announcement:', error);
    }
  };
  
  // Handle announcement deletion
  const handleDeleteAnnouncement = async (announcementId, groupId = null) => {
    try {
      const success = await deleteAnnouncement(announcementId, groupId);
      
      if (success) {
        if (groupId) {
          setGroupAnnouncements(prev => prev.filter(a => a.id !== announcementId));
        } else {
          setGeneralAnnouncements(prev => prev.filter(a => a.id !== announcementId));
        }
      }
    } catch (error) {
      console.error('Error deleting announcement:', error);
    }
  };
  
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" component="h2">
          <AnnouncementIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Bulletin Board
        </Typography>
        
        <Box>
          {tabValue === 0 && (
            <Button 
              variant="contained" 
              startIcon={<AddIcon />}
              onClick={() => handleNewAnnouncement(true)}
            >
              New Announcement
            </Button>
          )}
          
          {tabValue === 1 && selectedGroup && (
            <Button 
              variant="contained" 
              startIcon={<AddIcon />}
              onClick={() => handleNewAnnouncement(false)}
            >
              New Group Announcement
            </Button>
          )}
        </Box>
      </Box>
      
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="General Announcements" />
          <Tooltip title={!selectedGroup ? "Select a group first to view group announcements" : ""}>
            <span>
              <Tab label="Group Announcements" disabled={!selectedGroup} />
            </span>
          </Tooltip>
        </Tabs>
      </Paper>
      
      {tabValue === 0 && (
        <Box>
          {loading ? (
            <Typography>Loading announcements...</Typography>
          ) : generalAnnouncements.length === 0 ? (
            <Typography>No general announcements available.</Typography>
          ) : (
            generalAnnouncements.map(announcement => (
              <AnnouncementItem 
                key={announcement.id}
                announcement={announcement}
                onEdit={handleEditAnnouncement}
                onDelete={handleDeleteAnnouncement}
                isCreator={announcement.authorId === userId}
              />
            ))
          )}
        </Box>
      )}
      
      {tabValue === 1 && selectedGroup && (
        <Box>
          {loading ? (
            <Typography>Loading group announcements...</Typography>
          ) : groupAnnouncements.length === 0 ? (
            <Typography>No announcements for this group.</Typography>
          ) : (
            groupAnnouncements.map(announcement => (
              <AnnouncementItem 
                key={announcement.id}
                announcement={announcement}
                onEdit={handleEditAnnouncement}
                onDelete={handleDeleteAnnouncement}
                isCreator={announcement.authorId === userId}
              />
            ))
          )}
        </Box>
      )}
      
      {/* Dialog for creating/editing announcements */}
      <BulletinBoardDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        formValues={formValues}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        editingAnnouncement={editingAnnouncement}
        selectedGroup={selectedGroup}
      />
    </Box>
  );
};

export default BulletinBoard;
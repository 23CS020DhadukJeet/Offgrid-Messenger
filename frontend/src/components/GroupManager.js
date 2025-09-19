/**
 * GroupManager.js - Component for managing groups
 * 
 * This component provides functionality for creating, viewing, and managing groups.
 * It includes dialogs for creating new groups and managing group members.
 */

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import GroupIcon from '@mui/icons-material/Group';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import DeleteIcon from '@mui/icons-material/Delete';
import { createGroup, getUserGroups, addMemberToGroup, removeMemberFromGroup, deleteGroup } from '../services/groupService';

function GroupManager({ 
  open, 
  onClose, 
  userId, 
  availablePeers = [], 
  onGroupSelect,
  selectedGroup 
}) {
  const [groups, setGroups] = useState([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load user groups when component mounts or userId changes
  useEffect(() => {
    if (open && userId) {
      loadUserGroups();
    }
  }, [open, userId]);

  const loadUserGroups = async () => {
    try {
      setLoading(true);
      const userGroups = await getUserGroups(userId);
      setGroups(userGroups);
    } catch (error) {
      console.error('Error loading groups:', error);
      setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    try {
      setLoading(true);
      const result = await createGroup(newGroupName.trim(), userId, selectedMembers);
      
      if (result.success) {
        setGroups(prev => [...prev, result.group]);
        setNewGroupName('');
        setSelectedMembers([]);
        setCreateDialogOpen(false);
        setError(null);
      } else {
        setError('Failed to create group');
      }
    } catch (error) {
      console.error('Error creating group:', error);
      setError('Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (groupId, memberId) => {
    try {
      const success = await addMemberToGroup(groupId, memberId, userId);
      if (success) {
        // Reload groups to get updated member list
        loadUserGroups();
      } else {
        setError('Failed to add member to group');
      }
    } catch (error) {
      console.error('Error adding member:', error);
      setError('Failed to add member to group');
    }
  };

  const handleRemoveMember = async (groupId, memberId) => {
    try {
      const success = await removeMemberFromGroup(groupId, memberId, userId);
      if (success) {
        // Reload groups to get updated member list
        loadUserGroups();
      } else {
        setError('Failed to remove member from group');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      setError('Failed to remove member from group');
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this group?')) return;

    try {
      const success = await deleteGroup(groupId, userId);
      if (success) {
        setGroups(prev => prev.filter(g => g.id !== groupId));
        if (selectedGroup && selectedGroup.id === groupId) {
          onGroupSelect(null);
        }
      } else {
        setError('Failed to delete group');
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      setError('Failed to delete group');
    }
  };

  const toggleMemberSelection = (peerId) => {
    setSelectedMembers(prev => 
      prev.includes(peerId) 
        ? prev.filter(id => id !== peerId)
        : [...prev, peerId]
    );
  };

  const isMemberSelected = (peerId) => selectedMembers.includes(peerId);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Manage Groups</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Group
            </Button>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {error && (
            <Typography color="error" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}
          
          {loading ? (
            <Typography>Loading groups...</Typography>
          ) : groups.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No groups found. Create your first group to get started!
            </Typography>
          ) : (
            <List>
              {groups.map((group) => (
                <React.Fragment key={group.id}>
                  <ListItem
                    button
                    selected={selectedGroup && selectedGroup.id === group.id}
                    onClick={() => onGroupSelect(group)}
                    sx={{ 
                      borderRadius: 1, 
                      mb: 1,
                      backgroundColor: selectedGroup && selectedGroup.id === group.id 
                        ? 'primary.light' 
                        : 'transparent'
                    }}
                  >
                    <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                      <GroupIcon />
                    </Avatar>
                    <ListItemText
                      primary={group.name}
                      secondary={`${group.members.length} member${group.members.length !== 1 ? 's' : ''} • Created ${new Date(group.createdAt).toLocaleDateString()}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id);
                        }}
                        disabled={group.creator !== userId}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  
                  {/* Group members */}
                  {selectedGroup && selectedGroup.id === group.id && (
                    <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Members:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {group.members.map((memberId) => (
                          <Chip
                            key={memberId}
                            label={memberId === userId ? 'You' : memberId}
                            size="small"
                            onDelete={memberId !== userId && group.creator === userId ? 
                              () => handleRemoveMember(group.id, memberId) : 
                              undefined
                            }
                            deleteIcon={<PersonRemoveIcon />}
                          />
                        ))}
                      </Box>
                      
                      {/* Available peers to add */}
                      {group.creator === userId && availablePeers.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Add members:
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {availablePeers
                              .filter(peer => !group.members.includes(peer.id))
                              .map((peer) => (
                                <Chip
                                  key={peer.id}
                                  label={peer.hostname || peer.id}
                                  size="small"
                                  onClick={() => handleAddMember(group.id, peer.id)}
                                  icon={<PersonAddIcon />}
                                  color="primary"
                                  variant="outlined"
                                />
                              ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  )}
                  
                  <Divider sx={{ my: 1 }} />
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Group Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Group</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Group Name"
            fullWidth
            variant="outlined"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            sx={{ mb: 3 }}
          />
          
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Select members to add:
          </Typography>
          
          {availablePeers.length === 0 ? (
            <Typography color="text.secondary">
              No peers available to add to the group.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {availablePeers.map((peer) => (
                <Chip
                  key={peer.id}
                  label={peer.hostname || peer.id}
                  onClick={() => toggleMemberSelection(peer.id)}
                  color={isMemberSelected(peer.id) ? 'primary' : 'default'}
                  variant={isMemberSelected(peer.id) ? 'filled' : 'outlined'}
                />
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateGroup} 
            variant="contained"
            disabled={!newGroupName.trim() || loading}
          >
            Create Group
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default GroupManager;

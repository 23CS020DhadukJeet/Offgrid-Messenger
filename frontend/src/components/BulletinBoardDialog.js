/**
 * BulletinBoardDialog.js - Reusable dialog component for creating/editing announcements
 * 
 * This component provides a dialog for creating or editing bulletin board announcements,
 * with fields for title, content, priority, and announcement type.
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Tooltip
} from '@mui/material';

const BulletinBoardDialog = ({
  open,
  onClose,
  formValues,
  onInputChange,
  onSubmit,
  editingAnnouncement,
  selectedGroup
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
      </DialogTitle>
      
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          name="title"
          label="Title"
          type="text"
          fullWidth
          value={formValues.title}
          onChange={onInputChange}
          sx={{ mb: 2 }}
        />
        
        <TextField
          margin="dense"
          name="content"
          label="Content"
          multiline
          rows={4}
          fullWidth
          value={formValues.content}
          onChange={onInputChange}
          sx={{ mb: 2 }}
        />
        
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Priority</InputLabel>
          <Select
            name="priority"
            value={formValues.priority}
            onChange={onInputChange}
            label="Priority"
          >
            <MenuItem value="low">Low</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="high">High</MenuItem>
          </Select>
        </FormControl>
        
        {!editingAnnouncement && (
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              name="isGeneral"
              value={formValues.isGeneral}
              onChange={onInputChange}
              label="Type"
            >
              <MenuItem value={true}>General Announcement</MenuItem>
              <Tooltip title={!selectedGroup ? "Select a group first to create a group announcement" : ""}>
                <span>
                  <MenuItem value={false} disabled={!selectedGroup}>Group Announcement</MenuItem>
                </span>
              </Tooltip>
            </Select>
          </FormControl>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onSubmit} variant="contained" color="primary">
          {editingAnnouncement ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulletinBoardDialog;
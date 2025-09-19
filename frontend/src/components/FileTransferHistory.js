/**
 * FileTransferHistory.js - Component for displaying file transfer history
 * 
 * This component shows the complete history of file transfers including
 * sender/receiver information, timestamps, and transfer status.
 */

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CancelIcon from '@mui/icons-material/Cancel';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import GroupIcon from '@mui/icons-material/Group';
import PersonIcon from '@mui/icons-material/Person';
import { 
  getFileTransferHistory, 
  getFilteredFileTransferHistory, 
  getFileTransferStats,
  clearFileTransferHistory,
  searchFileTransferHistory 
} from '../services/fileTransferHistoryService';

function FileTransferHistory({ open, onClose }) {
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [stats, setStats] = useState({});
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  // Load history when component mounts or opens
  useEffect(() => {
    if (open) {
      loadHistory();
    }
  }, [open]);

  // Filter history when search query or tab changes
  useEffect(() => {
    filterHistory();
  }, [history, searchQuery, tabValue]);

  const loadHistory = () => {
    const historyData = getFileTransferHistory();
    setHistory(historyData);
    setStats(getFileTransferStats());
  };

  const filterHistory = () => {
    let filtered = history;

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = searchFileTransferHistory(searchQuery.trim());
    }

    // Apply tab filter
    switch (tabValue) {
      case 1: // Uploads
        filtered = filtered.filter(item => item.direction === 'upload');
        break;
      case 2: // Downloads
        filtered = filtered.filter(item => item.direction === 'download');
        break;
      case 3: // Completed
        filtered = filtered.filter(item => item.status === 'completed');
        break;
      case 4: // Failed
        filtered = filtered.filter(item => item.status === 'failed');
        break;
      default: // All
        break;
    }

    setFilteredHistory(filtered);
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleClearHistory = () => {
    clearFileTransferHistory();
    loadHistory();
    setClearDialogOpen(false);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" fontSize="small" />;
      case 'failed':
        return <ErrorIcon color="error" fontSize="small" />;
      case 'cancelled':
        return <CancelIcon color="warning" fontSize="small" />;
      default:
        return null;
    }
  };

  const getDirectionIcon = (direction) => {
    return direction === 'upload' ? 
      <UploadIcon fontSize="small" /> : 
      <DownloadIcon fontSize="small" />;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">File Transfer History</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {stats.total} transfers • {formatFileSize(stats.totalSize)}
            </Typography>
            <Button
              size="small"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setClearDialogOpen(true)}
            >
              Clear
            </Button>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Search and filters */}
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            placeholder="Search files, peers, or groups..."
            value={searchQuery}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')}>
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
            size="small"
          />
        </Box>

        {/* Tabs */}
        <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab label={`All (${stats.total})`} />
          <Tab label={`Uploads (${stats.uploads})`} />
          <Tab label={`Downloads (${stats.downloads})`} />
          <Tab label={`Completed (${stats.completed})`} />
          <Tab label={`Failed (${stats.failed})`} />
        </Tabs>

        <Divider sx={{ mb: 2 }} />

        {/* History list */}
        {filteredHistory.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              {searchQuery ? 'No transfers found matching your search' : 'No file transfers yet'}
            </Typography>
          </Box>
        ) : (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredHistory.map((item) => (
              <ListItem key={item.id} sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: item.direction === 'upload' ? 'primary.light' : 'secondary.light' }}>
                      {getDirectionIcon(item.direction)}
                    </Avatar>
                  </ListItemAvatar>
                  
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" className="text-ellipsis" title={item.fileName}>
                          {item.fileName}
                        </Typography>
                        {getStatusIcon(item.status)}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {item.groupId ? (
                            <>
                              <GroupIcon fontSize="small" />
                              <Typography variant="body2" color="text.secondary">
                                {item.groupName || 'Group'} • {item.direction === 'upload' ? 'Sent to' : 'Received from'} {item.peerName}
                              </Typography>
                            </>
                          ) : (
                            <>
                              <PersonIcon fontSize="small" />
                              <Typography variant="body2" color="text.secondary">
                                {item.direction === 'upload' ? 'Sent to' : 'Received from'} {item.peerName}
                              </Typography>
                            </>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {formatFileSize(item.fileSize)} • {formatTimestamp(item.timestamp)}
                          </Typography>
                          <Chip
                            label={item.status}
                            size="small"
                            color={getStatusColor(item.status)}
                            variant="outlined"
                          />
                        </Box>
                      </Box>
                    }
                  />
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      {/* Clear history confirmation dialog */}
      <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)}>
        <DialogTitle>Clear Transfer History</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to clear all file transfer history? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleClearHistory} color="error" variant="contained">
            Clear History
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

export default FileTransferHistory;

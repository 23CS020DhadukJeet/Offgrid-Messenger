/**
 * Sidebar.js - Sidebar component for displaying peers and file transfers
 * 
 * This component shows the list of available peers on the network and
 * the status of ongoing file transfers.
 */

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Badge from '@mui/material/Badge';
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import FolderIcon from '@mui/icons-material/Folder';
import ComputerIcon from '@mui/icons-material/Computer';
import GroupIcon from '@mui/icons-material/Group';
import RefreshIcon from '@mui/icons-material/Refresh';
import WifiIcon from '@mui/icons-material/Wifi';
import CallIcon from '@mui/icons-material/Call';

// TabPanel component for tab content
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`sidebar-tabpanel-${index}`}
      aria-labelledby={`sidebar-tab-${index}`}
      {...other}
      style={{ height: '100%', overflow: 'auto' }}
    >
      {value === index && (
        <Box sx={{ p: 0, height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function Sidebar({ 
  peers, 
  selectedPeer, 
  onSelectPeer, 
  fileTransfers, 
  groups = [], 
  selectedGroup, 
  onSelectGroup,
  onManageGroups,
  onCallPeer 
}) {
  const [tabValue, setTabValue] = useState(0);
  const [openManualConnect, setOpenManualConnect] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [manualPort, setManualPort] = useState('8080');
  const [connectError, setConnectError] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(true);
  const [discoveryStatus, setDiscoveryStatus] = useState('Searching for peers...');
  
  // Simulate peer discovery process
  useEffect(() => {
    setIsDiscovering(true);
    setDiscoveryStatus('Searching for peers...');
    
    // After 5 seconds, update the status based on whether peers were found
    const timer = setTimeout(() => {
      setIsDiscovering(false);
      setDiscoveryStatus(peers.length > 0 ? 
        `Found ${peers.length} peer${peers.length === 1 ? '' : 's'}` : 
        'No peers found on the network');
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [peers.length]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  const handleManualConnect = async () => {
    if (!manualIp) {
      setConnectError('IP address is required');
      return;
    }
    
    try {
      // Use the correct endpoint path that matches the backend
      const response = await fetch(`http://localhost:8080/api/peers/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ip: manualIp, port: manualPort }),
      });
      
      // Check if response is OK before trying to parse JSON
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          setOpenManualConnect(false);
          setManualIp('');
          setConnectError('');
        } else {
          setConnectError(data.message || 'Failed to connect to peer');
        }
      } else {
        setConnectError(`Server error: ${response.status}`);
      }
    } catch (error) {
      setConnectError('Connection error: ' + error.message);
    }
  };
  
  // Function to manually trigger peer discovery
  const handleRefreshPeers = async () => {
    setIsDiscovering(true);
    setDiscoveryStatus('Searching for peers...');
    
    try {
      // Trigger a new discovery scan on the backend
      await fetch('http://localhost:8080/api/peers/discover', { method: 'POST' });
      
      // Discovery process will be updated via the useEffect when peers state changes
    } catch (error) {
      console.error('Error triggering peer discovery:', error);
      setIsDiscovering(false);
      setDiscoveryStatus('Error refreshing peers');
    }
  };

  return (
    <Box sx={{ 
      width: 280, 
      borderRight: 1, 
      borderColor: 'divider',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      <Tabs 
        value={tabValue} 
        onChange={handleTabChange} 
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Peers" />
        <Tab 
          label="Groups" 
          icon={groups.length > 0 ? 
            <Badge color="secondary" badgeContent={groups.length} sx={{ mr: 1 }} /> : 
            null
          } 
          iconPosition="start"
        />
        <Tab 
          label="Files" 
          icon={fileTransfers.length > 0 ? 
            <Badge color="secondary" badgeContent={fileTransfers.length} sx={{ mr: 1 }} /> : 
            null
          } 
          iconPosition="start"
        />
      </Tabs>
      
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Tooltip title="Refresh peer list">
                <IconButton 
                  size="small" 
                  onClick={handleRefreshPeers}
                  disabled={isDiscovering}
                >
                  {isDiscovering ? 
                    <CircularProgress size={20} /> : 
                    <RefreshIcon />
                  }
                </IconButton>
              </Tooltip>
              
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {isDiscovering && (
                  <Chip 
                    icon={<WifiIcon />} 
                    label="Scanning..." 
                    size="small" 
                    color="primary" 
                    variant="outlined"
                    sx={{ mr: 1 }}
                  />
                )}
                <Button 
                  variant="outlined" 
                  size="small" 
                  startIcon={<AddIcon />}
                  onClick={() => setOpenManualConnect(true)}
                >
                  Add Peer
                </Button>
              </Box>
            </Box>
            
            {peers.length > 0 ? (
              <List sx={{ padding: 0, flexGrow: 1, overflow: 'auto' }}>
                {peers.map((peer) => (
                  <ListItem 
                    key={peer.id} 
                    disablePadding
                    secondaryAction={null}
                    sx={{ opacity: peer.authorized ? 1 : 0.6 }}
                  >
                    <ListItemButton 
                      selected={selectedPeer && selectedPeer.id === peer.id}
                      onClick={() => onSelectPeer(peer)}
                      disabled={!peer.authorized}
                    >
                      <ListItemAvatar>
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          badgeContent={
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                bgcolor: peer.authorized ? 'success.main' : 'text.disabled',
                                border: '1px solid white'
                              }}
                            />
                          }
                        >
                          <Avatar sx={{ bgcolor: peer.authorized ? 'primary.main' : 'grey.500' }}>
                            <ComputerIcon />
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText 
                        primary={peer.hostname || 'Unknown'}
                        secondary={
                          <React.Fragment>
                            {peer.ip}
                            {!peer.authorized && (
                              <Typography
                                component="span"
                                variant="caption"
                                color="error"
                                sx={{ display: 'block', mt: 0.5 }}
                              >
                                Unauthorized
                              </Typography>
                            )}
                          </React.Fragment>
                        }
                        primaryTypographyProps={{
                          className: 'text-ellipsis',
                          title: peer.hostname || 'Unknown'
                        }}
                        secondaryTypographyProps={{
                          className: 'text-ellipsis',
                          title: peer.ip
                        }}
                      />
                      <IconButton 
                        edge="end" 
                        aria-label="call"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (typeof onCallPeer === 'function' && peer.authorized) {
                            onCallPeer(peer.id);
                          }
                        }}
                        disabled={!peer.authorized}
                      >
                        <CallIcon />
                      </IconButton>
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  {discoveryStatus}
                </Typography>
                {!isDiscovering && (
                  <Button 
                    variant="text" 
                    size="small" 
                    startIcon={<RefreshIcon />}
                    onClick={handleRefreshPeers}
                    sx={{ mt: 1 }}
                  >
                    Refresh
                  </Button>
                )}
              </Box>
            )}
          </Box>
          
          {/* Manual Peer Connection Dialog */}
          <Dialog open={openManualConnect} onClose={() => setOpenManualConnect(false)}>
            <DialogTitle>Connect to Peer</DialogTitle>
            <DialogContent>
              <DialogContentText>
                Enter the IP address and port of the peer you want to connect to.
              </DialogContentText>
              <TextField
                autoFocus
                margin="dense"
                id="ip"
                label="IP Address"
                type="text"
                fullWidth
                variant="outlined"
                value={manualIp}
                onChange={(e) => setManualIp(e.target.value)}
                error={!!connectError}
                helperText={connectError}
              />
              <TextField
                margin="dense"
                id="port"
                label="Port"
                type="text"
                fullWidth
                variant="outlined"
                value={manualPort}
                onChange={(e) => setManualPort(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenManualConnect(false)}>Cancel</Button>
              <Button onClick={handleManualConnect}>Connect</Button>
            </DialogActions>
          </Dialog>
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          {groups.length > 0 ? (
            <List sx={{ padding: 0 }}>
              {groups.map((group) => (
                <ListItem 
                  key={group.id} 
                  disablePadding
                  secondaryAction={
                    <IconButton 
                      edge="end" 
                      onClick={() => onManageGroups && onManageGroups()}
                      size="small"
                    >
                      <GroupIcon />
                    </IconButton>
                  }
                >
                  <ListItemButton 
                    selected={selectedGroup && selectedGroup.id === group.id}
                    onClick={() => onSelectGroup && onSelectGroup(group)}
                  >
                    <ListItemAvatar>
                      <Avatar>
                        <GroupIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary={group.name}
                      secondary={`${group.members.length} member${group.members.length !== 1 ? 's' : ''}`}
                      primaryTypographyProps={{
                        className: 'text-ellipsis',
                        title: group.name
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No groups found
              </Typography>
              <Button 
                variant="outlined" 
                size="small" 
                sx={{ mt: 1 }}
                onClick={() => onManageGroups && onManageGroups()}
              >
                Create Group
              </Button>
            </Box>
          )}
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          {fileTransfers.length > 0 ? (
            <List sx={{ padding: 0 }}>
              {fileTransfers.map((transfer) => (
                <ListItem key={transfer.id} sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Avatar sx={{ mr: 2 }}>
                      <FolderIcon />
                    </Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body1" className="text-ellipsis" title={transfer.fileName}>
                        {transfer.fileName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatFileSize(transfer.fileSize)} - {transfer.status}
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={transfer.progress} 
                        sx={{ mt: 1 }}
                      />
                    </Box>
                  </Box>
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No active file transfers
              </Typography>
            </Box>
          )}
        </TabPanel>
      </Box>
    </Box>
  );
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default Sidebar;
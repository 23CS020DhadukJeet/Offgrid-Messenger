/**
 * electron.js - Electron main process for Offgrid Messenger
 * 
 * This file sets up the Electron application, creates the main window,
 * and handles communication between the renderer process and the backend.
 */

const { app, BrowserWindow, ipcMain, Menu, Tray, dialog, clipboard, shell, nativeImage } = require('electron');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');
const fs = require('fs');
const dgram = require('dgram');
const os = require('os');

// Keep a global reference of the window object to avoid garbage collection
let mainWindow;

// Keep a reference to the backend server process
let backendProcess;

// Keep a reference to the tray icon
let tray = null;

// Flag to track if the app is quitting
let isQuitting = false;

// UDP discovery configuration
const BROADCAST_INTERVAL = 5000; // milliseconds
let udpSocket = null;
let discoveryInterval = null;

/**
 * Create the main application window
 */
function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'public', 'icon.png')
  });

  // Load the index.html of the app
  const startUrl = process.env.ELECTRON_START_URL || url.format({
    pathname: path.join(__dirname, 'build', 'index.html'),
    protocol: 'file:',
    slashes: true
  });
  
  mainWindow.loadURL(startUrl);

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Handle window close event
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  // Handle window closed event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create tray icon
  createTray();
}

/**
 * Create the system tray icon and menu
 */
function createTray() {
  const iconPath = path.join(__dirname, 'public', 'icon.png');
  tray = new Tray(nativeImage.createFromPath(iconPath));
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Open IP Messenger', 
      click: () => {
        mainWindow.show();
      } 
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        isQuitting = true;
        app.quit();
      } 
    }
  ]);
  
  tray.setToolTip('Offgrid Messenger');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

/**
 * Get local IP address
 */
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip over non-IPv4 and internal (loopback) addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1'; // Fallback to localhost if no other IP is found
}

/**
 * Start UDP discovery service
 */
function startUDPDiscovery() {
  const localIp = getLocalIpAddress();
  const hostname = os.hostname();
  
  // Create UDP socket
  udpSocket = dgram.createSocket('udp4');
  
  // Handle UDP socket errors
  udpSocket.on('error', (err) => {
    console.error(`UDP socket error: ${err.message}`);
    udpSocket.close();
  });
  
  // Handle incoming UDP messages
  udpSocket.on('message', (msg, rinfo) => {
    try {
      const message = JSON.parse(msg.toString());
      
      if (message.type === 'discovery_response') {
        console.log(`Discovery response from ${rinfo.address}:${rinfo.port}`);
        
        // Forward discovery response to renderer process
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('peer-discovered', {
            ip: message.ip,
            port: message.port,
            hostname: message.hostname,
            discoveredAt: Date.now()
          });
        }
      }
    } catch (error) {
      console.error('Error processing UDP message:', error);
    }
  });
  
  // Bind UDP socket to any available port
  udpSocket.bind(() => {
    const clientPort = udpSocket.address().port;
    console.log(`UDP discovery client running on port ${clientPort}`);
    
    // Enable broadcast
    udpSocket.setBroadcast(true);
    
    // Start broadcasting discovery messages
    discoveryInterval = setInterval(() => {
      const discoveryMessage = {
        type: 'discovery',
        ip: localIp,
        port: 8080, // WebSocket port
        hostname: hostname
      };
      
      const messageBuffer = Buffer.from(JSON.stringify(discoveryMessage));
      
      // Broadcast to the LAN on the server's UDP port
      udpSocket.send(messageBuffer, 0, messageBuffer.length, 8081, '255.255.255.255');
    }, BROADCAST_INTERVAL);
  });
}

/**
 * Stop UDP discovery service
 */
function stopUDPDiscovery() {
  if (discoveryInterval) {
    clearInterval(discoveryInterval);
    discoveryInterval = null;
  }
  
  if (udpSocket) {
    udpSocket.close();
    udpSocket = null;
  }
}

/**
 * Start the backend server process
 */
function startBackendServer() {
  const backendPath = path.join(__dirname, '..', 'backend', 'server.js');
  
  // Check if the backend file exists
  if (!fs.existsSync(backendPath)) {
    dialog.showErrorBox(
      'Backend Not Found',
      'Could not find the backend server file. Please make sure the application is properly installed.'
    );
    app.quit();
    return;
  }
  
  // Start the backend server as a child process
  backendProcess = spawn('node', [backendPath], {
    stdio: 'pipe'
  });
  
  // Handle backend process output
  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
    
    // Forward important messages to the renderer process
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('backend-log', data.toString());
    }
  });
  
  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
    
    // Forward error messages to the renderer process
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('backend-error', data.toString());
    }
  });
  
  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
    
    // Notify the renderer process that the backend has stopped
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('backend-stopped', code);
    }
    
    // If the app is not quitting, try to restart the backend
    if (!isQuitting) {
      console.log('Attempting to restart backend...');
      startBackendServer();
    }
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Start the backend server
  startBackendServer();
  
  // Start UDP discovery service
  startUDPDiscovery();
  
  // Create the main window
  createWindow();
  
  // On macOS it's common to re-create a window when the dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app before-quit event
app.on('before-quit', () => {
  isQuitting = true;
  
  // Stop UDP discovery
  stopUDPDiscovery();
  
  // Kill the backend process
  if (backendProcess) {
    backendProcess.kill();
  }
});

// IPC handlers for communication with renderer process

/**
 * Handle sending a chat message
 */
ipcMain.on('send-message', (event, message) => {
  // Forward to backend through IPC or other means
  console.log('Message to send:', message);
  // This would typically involve sending the message to the backend
});

/**
 * Handle file selection for sending
 */
ipcMain.on('select-file', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    event.reply('file-selected', {
      path: filePath,
      name: path.basename(filePath),
      size: fs.statSync(filePath).size
    });
  }
});

/**
 * Handle clipboard content sharing
 */
ipcMain.on('get-clipboard-content', (event) => {
  const text = clipboard.readText();
  event.reply('clipboard-content', text);
});

/**
 * Handle setting clipboard content
 */
ipcMain.on('set-clipboard-content', (event, text) => {
  clipboard.writeText(text);
  event.reply('clipboard-set-success');
});

/**
 * Handle opening a file in the default application
 */
ipcMain.on('open-file', (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.openPath(filePath);
  } else {
    event.reply('file-not-found', filePath);
  }
});

/**
 * Handle showing a notification
 */
ipcMain.on('show-notification', (event, notification) => {
  if (mainWindow && !mainWindow.isFocused()) {
    // If the window is not focused, show a system notification
    const notificationObj = new Notification({
      title: notification.title || 'IP Messenger',
      body: notification.body,
      icon: path.join(__dirname, 'public', 'icon.png')
    });
    
    notificationObj.show();
    
    notificationObj.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }
});
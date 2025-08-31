# IP Messenger Clone

A LAN-based messaging application built with Node.js, Electron, and React that allows users to communicate within a local network. This application supports peer-to-peer messaging, file transfers, and clipboard sharing with AES encryption.

## Features

- **Peer Discovery**: Automatically discover other users on the same LAN using UDP broadcasting
- **Text Messaging**: Send and receive text messages to/from peers
- **File Transfer**: Share files of any type with peers
- **Clipboard Sharing**: Share clipboard content with peers
- **Notifications**: System and in-app notifications for messages and events
- **AES Encryption**: Secure communication with AES encryption
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Project Structure

```
ip-messenger-clone/
├── backend/                 # Node.js backend
│   ├── server.js           # WebSocket and UDP server
│   ├── peers.js            # Peer management
│   ├── fileTransfer.js     # File transfer functionality
│   ├── encryption.js       # AES encryption
│   └── package.json        # Backend dependencies
├── frontend/               # Electron and React frontend
│   ├── electron.js         # Electron main process
│   ├── preload.js          # Electron preload script
│   ├── package.json        # Frontend dependencies
│   ├── public/             # Static assets
│   └── src/                # React source code
│       ├── components/     # React components
│       ├── pages/          # React pages
│       ├── services/       # Utility services
│       ├── App.js          # Main React component
│       └── index.js        # React entry point
└── README.md               # Project documentation
```

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/ip-messenger-clone.git
cd ip-messenger-clone
```

2. Install backend dependencies:

```bash
cd backend
npm install
```

3. Install frontend dependencies:

```bash
cd ../frontend
npm install
```

## Running the Application

1. Start the application:

```bash
cd frontend
npm start
```

This will start both the backend server and the Electron application.

## Development

1. Start the backend in development mode:

```bash
cd backend
npm run dev
```

2. Start the frontend in development mode:

```bash
cd frontend
npm run dev
```

## Building for Production

To build the application for production:

```bash
cd frontend
npm run build
```

This will create a distributable package in the `frontend/dist` directory.

## Security

This application uses AES encryption for all communications. The encryption key is hardcoded in the `encryption.js` file. For production use, it is recommended to implement a more secure key management system.

## License

MIT
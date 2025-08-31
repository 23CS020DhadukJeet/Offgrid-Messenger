/**
 * index.js - Entry point for the React application
 * 
 * This file renders the main App component to the DOM and sets up
 * the necessary providers for the application.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
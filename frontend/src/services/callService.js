/**
 * callService.js - Service for managing voice and video calls
 * 
 * This service handles WebRTC connections for peer-to-peer voice and video calls,
 * including both individual and group calls.
 */

import { sendMessage } from './websocketService';

// Configuration for WebRTC
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

// Store active calls
let activeCall = null;
let activeGroupCall = null;
let localStream = null;
let peerConnections = new Map(); // For group calls

// Event callbacks
const eventListeners = {
  onCallIncoming: null,
  onCallStarted: null,
  onCallEnded: null,
  onCallAccepted: null,
  onCallRejected: null,
  onGroupCallIncoming: null,
  onGroupCallStarted: null,
  onGroupCallEnded: null,
  onGroupCallParticipantJoined: null,
  onGroupCallParticipantLeft: null,
  onRemoteStreamAdded: null,
  onRemoteStreamRemoved: null,
  onError: null
};

/**
 * Initialize the call service with event handlers
 * @param {Object} handlers - Event handler functions
 */
export function initializeCallService(handlers) {
  Object.keys(handlers).forEach(key => {
    if (typeof handlers[key] === 'function') {
      eventListeners[key] = handlers[key];
    }
  });
}

/**
 * Handle incoming WebSocket messages related to calls
 * @param {Object} message - The received message
 */
export function handleCallMessage(message) {
  switch (message.type) {
    case 'call_incoming':
      if (eventListeners.onCallIncoming) {
        eventListeners.onCallIncoming(message);
      }
      break;
      
    case 'call_accepted':
      if (activeCall && activeCall.callId === message.callId) {
        activeCall.status = 'active';
        if (eventListeners.onCallAccepted) {
          eventListeners.onCallAccepted(message);
        }
        // Create and send offer
        createAndSendOffer(activeCall.callId, activeCall.calleeId);
      }
      break;
      
    case 'call_rejected':
      if (activeCall && activeCall.callId === message.callId) {
        activeCall.status = 'rejected';
        activeCall.rejectionReason = message.reason;
        if (eventListeners.onCallRejected) {
          eventListeners.onCallRejected(message);
        }
        cleanupCall();
      }
      break;
      
    case 'call_ended':
      if (activeCall && activeCall.callId === message.callId) {
        if (eventListeners.onCallEnded) {
          eventListeners.onCallEnded(message);
        }
        cleanupCall();
      }
      break;
      
    case 'call_failed':
      if (activeCall && activeCall.callId === message.callId) {
        if (eventListeners.onError) {
          eventListeners.onError(message.reason);
        }
        cleanupCall();
      }
      break;
      
    case 'sdp':
      handleSdpMessage(message);
      break;
      
    case 'ice-candidate':
      handleIceCandidateMessage(message);
      break;
      
    case 'group_call_incoming':
      if (eventListeners.onGroupCallIncoming) {
        eventListeners.onGroupCallIncoming(message);
      }
      break;
      
    case 'group_call_participant_joined':
      if (activeGroupCall && activeGroupCall.groupCallId === message.groupCallId) {
        // Add the new participant to our list
        if (!activeGroupCall.participants.includes(message.participantId)) {
          activeGroupCall.participants.push(message.participantId);
        }
        
        if (eventListeners.onGroupCallParticipantJoined) {
          eventListeners.onGroupCallParticipantJoined(message);
        }
        
        // If we're the initiator, create and send offer to the new participant
        if (activeGroupCall.isInitiator) {
          createAndSendGroupOffer(activeGroupCall.groupCallId, message.participantId);
        }
      }
      break;
      
    case 'group_call_participant_left':
      if (activeGroupCall && activeGroupCall.groupCallId === message.groupCallId) {
        // Remove the participant from our list
        activeGroupCall.participants = activeGroupCall.participants.filter(
          id => id !== message.participantId
        );
        
        // Close and remove the peer connection
        if (peerConnections.has(message.participantId)) {
          peerConnections.get(message.participantId).close();
          peerConnections.delete(message.participantId);
        }
        
        if (eventListeners.onGroupCallParticipantLeft) {
          eventListeners.onGroupCallParticipantLeft(message);
        }
      }
      break;
      
    case 'group_call_ended':
      if (activeGroupCall && activeGroupCall.groupCallId === message.groupCallId) {
        if (eventListeners.onGroupCallEnded) {
          eventListeners.onGroupCallEnded(message);
        }
        cleanupGroupCall();
      }
      break;
      
    case 'group_sdp':
      handleGroupSdpMessage(message);
      break;
      
    case 'group_ice_candidate':
      handleGroupIceCandidateMessage(message);
      break;
  }
}

/**
 * Initiate a call to another peer
 * @param {string} calleeId - ID of the peer to call
 * @param {boolean} withVideo - Whether to include video
 */
export async function initiateCall(calleeId, withVideo = false) {
  try {
    // Get user media
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo
    });
    
    // Create a new call
    activeCall = {
      callId: null, // Will be set by the server
      calleeId,
      withVideo,
      status: 'initiating',
      peerConnection: new RTCPeerConnection(ICE_SERVERS)
    };
    
    // Add local stream to peer connection
    localStream.getTracks().forEach(track => {
      activeCall.peerConnection.addTrack(track, localStream);
    });
    
    // Set up event handlers for the peer connection
    setupPeerConnectionEvents(activeCall.peerConnection);
    
    // Send call initiation message
    sendMessage({
      type: 'call_initiate',
      calleeId,
      withVideo
    });
    
    if (eventListeners.onCallStarted) {
      eventListeners.onCallStarted({
        calleeId,
        withVideo,
        localStream
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error initiating call:', error);
    if (eventListeners.onError) {
      eventListeners.onError(error.message);
    }
    cleanupCall();
    return false;
  }
}

/**
 * Accept an incoming call
 * @param {string} callId - ID of the call to accept
 * @param {boolean} withVideo - Whether to include video
 */
export async function acceptCall(callId, callerId, withVideo) {
  try {
    // Get user media
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo
    });
    
    // Create a new call
    activeCall = {
      callId,
      callerId,
      withVideo,
      status: 'active',
      peerConnection: new RTCPeerConnection(ICE_SERVERS)
    };
    
    // Add local stream to peer connection
    localStream.getTracks().forEach(track => {
      activeCall.peerConnection.addTrack(track, localStream);
    });
    
    // Set up event handlers for the peer connection
    setupPeerConnectionEvents(activeCall.peerConnection);
    
    // Send call acceptance message
    sendMessage({
      type: 'call_accept',
      callId
    });
    
    if (eventListeners.onCallStarted) {
      eventListeners.onCallStarted({
        callerId,
        withVideo,
        localStream
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error accepting call:', error);
    if (eventListeners.onError) {
      eventListeners.onError(error.message);
    }
    rejectCall(callId, 'Failed to access media devices');
    return false;
  }
}

/**
 * Reject an incoming call
 * @param {string} callId - ID of the call to reject
 * @param {string} reason - Reason for rejection
 */
export function rejectCall(callId, reason = 'Call declined') {
  sendMessage({
    type: 'call_reject',
    callId,
    reason
  });
  
  return true;
}

/**
 * End an active call
 */
export function endCall() {
  if (!activeCall) return false;
  
  sendMessage({
    type: 'call_end',
    callId: activeCall.callId
  });
  
  cleanupCall();
  return true;
}

/**
 * Initiate a group call
 * @param {string} groupId - ID of the group
 * @param {boolean} withVideo - Whether to include video
 */
export async function initiateGroupCall(groupId, withVideo = false) {
  try {
    // Get user media
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo
    });
    
    // Create a new group call
    activeGroupCall = {
      groupCallId: null, // Will be set by the server
      groupId,
      withVideo,
      status: 'initiating',
      isInitiator: true,
      participants: [] // Will be populated as participants join
    };
    
    // Send group call initiation message
    sendMessage({
      type: 'group_call_initiate',
      groupId,
      withVideo
    });
    
    if (eventListeners.onGroupCallStarted) {
      eventListeners.onGroupCallStarted({
        groupId,
        withVideo,
        localStream
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error initiating group call:', error);
    if (eventListeners.onError) {
      eventListeners.onError(error.message);
    }
    cleanupGroupCall();
    return false;
  }
}

/**
 * Join a group call
 * @param {string} groupCallId - ID of the group call
 * @param {string} groupId - ID of the group
 * @param {boolean} withVideo - Whether to include video
 */
export async function joinGroupCall(groupCallId, groupId, withVideo) {
  try {
    // Get user media
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo
    });
    
    // Create a new group call
    activeGroupCall = {
      groupCallId,
      groupId,
      withVideo,
      status: 'active',
      isInitiator: false,
      participants: [] // Will be populated as we connect to other participants
    };
    
    // Send group call join message
    sendMessage({
      type: 'group_call_join',
      groupCallId
    });
    
    if (eventListeners.onGroupCallStarted) {
      eventListeners.onGroupCallStarted({
        groupId,
        withVideo,
        localStream
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error joining group call:', error);
    if (eventListeners.onError) {
      eventListeners.onError(error.message);
    }
    cleanupGroupCall();
    return false;
  }
}

/**
 * Leave a group call
 */
export function leaveGroupCall() {
  if (!activeGroupCall) return false;
  
  sendMessage({
    type: 'group_call_leave',
    groupCallId: activeGroupCall.groupCallId
  });
  
  cleanupGroupCall();
  return true;
}

/**
 * End a group call (only the initiator can do this)
 */
export function endGroupCall() {
  if (!activeGroupCall || !activeGroupCall.isInitiator) return false;
  
  sendMessage({
    type: 'group_call_end',
    groupCallId: activeGroupCall.groupCallId
  });
  
  cleanupGroupCall();
  return true;
}

/**
 * Create and send an SDP offer for a call
 * @param {string} callId - ID of the call
 * @param {string} recipientId - ID of the recipient
 */
async function createAndSendOffer(callId, recipientId) {
  try {
    const offer = await activeCall.peerConnection.createOffer();
    await activeCall.peerConnection.setLocalDescription(offer);
    
    sendMessage({
      type: 'sdp_offer',
      callId,
      sdp: activeCall.peerConnection.localDescription
    });
  } catch (error) {
    console.error('Error creating offer:', error);
    if (eventListeners.onError) {
      eventListeners.onError(error.message);
    }
  }
}

/**
 * Create and send an SDP offer for a group call
 * @param {string} groupCallId - ID of the group call
 * @param {string} recipientId - ID of the recipient
 */
async function createAndSendGroupOffer(groupCallId, recipientId) {
  try {
    // Create a new peer connection for this participant
    const peerConnection = new RTCPeerConnection(ICE_SERVERS);
    
    // Add local stream to peer connection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
    
    // Set up event handlers for the peer connection
    setupPeerConnectionEvents(peerConnection, recipientId);
    
    // Store the peer connection
    peerConnections.set(recipientId, peerConnection);
    
    // Create and send offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    sendMessage({
      type: 'group_sdp_offer',
      groupCallId,
      recipientId,
      sdp: peerConnection.localDescription
    });
  } catch (error) {
    console.error('Error creating group offer:', error);
    if (eventListeners.onError) {
      eventListeners.onError(error.message);
    }
  }
}

/**
 * Handle an SDP message
 * @param {Object} message - The SDP message
 */
async function handleSdpMessage(message) {
  if (!activeCall || activeCall.callId !== message.callId) return;
  
  try {
    const peerConnection = activeCall.peerConnection;
    const sdp = message.sdp;
    
    if (message.sdpType === 'offer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      sendMessage({
        type: 'sdp_answer',
        callId: message.callId,
        sdp: peerConnection.localDescription
      });
    } else if (message.sdpType === 'answer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  } catch (error) {
    console.error('Error handling SDP message:', error);
    if (eventListeners.onError) {
      eventListeners.onError(error.message);
    }
  }
}

/**
 * Handle a group SDP message
 * @param {Object} message - The group SDP message
 */
async function handleGroupSdpMessage(message) {
  if (!activeGroupCall || activeGroupCall.groupCallId !== message.groupCallId) return;
  
  try {
    const senderId = message.senderId;
    let peerConnection;
    
    if (peerConnections.has(senderId)) {
      peerConnection = peerConnections.get(senderId);
    } else {
      // Create a new peer connection for this participant
      peerConnection = new RTCPeerConnection(ICE_SERVERS);
      
      // Add local stream to peer connection
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
      
      // Set up event handlers for the peer connection
      setupPeerConnectionEvents(peerConnection, senderId);
      
      // Store the peer connection
      peerConnections.set(senderId, peerConnection);
    }
    
    const sdp = message.sdp;
    
    if (message.sdpType === 'offer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      sendMessage({
        type: 'group_sdp_answer',
        groupCallId: message.groupCallId,
        recipientId: senderId,
        sdp: peerConnection.localDescription
      });
    } else if (message.sdpType === 'answer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  } catch (error) {
    console.error('Error handling group SDP message:', error);
    if (eventListeners.onError) {
      eventListeners.onError(error.message);
    }
  }
}

/**
 * Handle an ICE candidate message
 * @param {Object} message - The ICE candidate message
 */
function handleIceCandidateMessage(message) {
  if (!activeCall || activeCall.callId !== message.callId) return;
  
  try {
    const candidate = new RTCIceCandidate(message.candidate);
    activeCall.peerConnection.addIceCandidate(candidate);
  } catch (error) {
    console.error('Error handling ICE candidate:', error);
  }
}

/**
 * Handle a group ICE candidate message
 * @param {Object} message - The group ICE candidate message
 */
function handleGroupIceCandidateMessage(message) {
  if (!activeGroupCall || activeGroupCall.groupCallId !== message.groupCallId) return;
  
  try {
    const senderId = message.senderId;
    if (peerConnections.has(senderId)) {
      const candidate = new RTCIceCandidate(message.candidate);
      peerConnections.get(senderId).addIceCandidate(candidate);
    }
  } catch (error) {
    console.error('Error handling group ICE candidate:', error);
  }
}

/**
 * Set up event handlers for a peer connection
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @param {string} participantId - ID of the participant (for group calls)
 */
function setupPeerConnectionEvents(peerConnection, participantId = null) {
  // ICE candidate event
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      if (participantId) {
        // Group call
        sendMessage({
          type: 'group_ice_candidate',
          groupCallId: activeGroupCall.groupCallId,
          recipientId: participantId,
          candidate: event.candidate
        });
      } else {
        // Individual call
        sendMessage({
          type: 'ice_candidate',
          callId: activeCall.callId,
          candidate: event.candidate
        });
      }
    }
  };
  
  // Track event (remote stream added)
  peerConnection.ontrack = (event) => {
    if (eventListeners.onRemoteStreamAdded) {
      eventListeners.onRemoteStreamAdded(event.streams[0], participantId);
    }
  };
  
  // Connection state change event
  peerConnection.onconnectionstatechange = () => {
    if (peerConnection.connectionState === 'disconnected' || 
        peerConnection.connectionState === 'failed' ||
        peerConnection.connectionState === 'closed') {
      if (participantId && peerConnections.has(participantId)) {
        peerConnections.delete(participantId);
        if (eventListeners.onRemoteStreamRemoved) {
          eventListeners.onRemoteStreamRemoved(participantId);
        }
      }
    }
  };
}

/**
 * Clean up resources for an individual call
 */
function cleanupCall() {
  if (activeCall && activeCall.peerConnection) {
    activeCall.peerConnection.close();
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  activeCall = null;
}

/**
 * Clean up resources for a group call
 */
function cleanupGroupCall() {
  // Close all peer connections
  peerConnections.forEach(connection => {
    connection.close();
  });
  peerConnections.clear();
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  activeGroupCall = null;
}

/**
 * Toggle mute status for audio
 * @returns {boolean} - New mute status
 */
export function toggleAudioMute() {
  if (!localStream) return false;
  
  const audioTrack = localStream.getAudioTracks()[0];
  if (!audioTrack) return false;
  
  audioTrack.enabled = !audioTrack.enabled;
  return !audioTrack.enabled; // Return true if muted
}

/**
 * Toggle video status
 * @returns {boolean} - New video status
 */
export function toggleVideo() {
  if (!localStream) return false;
  
  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return false;
  
  videoTrack.enabled = !videoTrack.enabled;
  return videoTrack.enabled; // Return true if video is enabled
}

/**
 * Check if a call is active
 * @returns {boolean} - Whether a call is active
 */
export function isCallActive() {
  return activeCall !== null || activeGroupCall !== null;
}

/**
 * Get the active call information
 * @returns {Object|null} - Active call information or null if no call is active
 */
export function getActiveCall() {
  return activeCall || activeGroupCall;
}

/**
 * Get the local media stream
 * @returns {MediaStream|null} - Local media stream or null if no call is active
 */
export function getLocalStream() {
  return localStream;
}
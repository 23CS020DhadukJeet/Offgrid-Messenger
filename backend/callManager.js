/**
 * callManager.js - Voice and video call management module
 * 
 * This module handles WebRTC signaling for peer-to-peer voice and video calls,
 * including both individual and group calls.
 */

const { getPeerById, getPeers } = require('./peers');
const { isGroupMember, broadcastToGroupMembers } = require('./groupManager');

// Store active calls
const activeCalls = new Map();
// Store group calls
const groupCalls = new Map();

/**
 * Initialize a call between peers
 * @param {string} callerId - ID of the caller
 * @param {string} calleeId - ID of the callee
 * @param {boolean} withVideo - Whether to include video
 * @returns {string} - Call ID
 */
function initiateCall(callerId, calleeId, withVideo = false) {
  const callId = `${callerId}-${calleeId}-${Date.now()}`;
  
  activeCalls.set(callId, {
    callId,
    callerId,
    calleeId,
    withVideo,
    status: 'initiating',
    startTime: Date.now(),
    endTime: null,
    iceExchangeComplete: false
  });
  
  console.log(`Call initiated: ${callId} from ${callerId} to ${calleeId}`);
  return callId;
}

/**
 * Handle call acceptance
 * @param {string} callId - ID of the call
 * @returns {boolean} - Success status
 */
function acceptCall(callId) {
  const call = activeCalls.get(callId);
  if (!call) {
    console.error(`Cannot accept call: Call ${callId} not found`);
    return false;
  }
  
  call.status = 'active';
  activeCalls.set(callId, call);
  console.log(`Call accepted: ${callId}`);
  return true;
}

/**
 * Handle call rejection
 * @param {string} callId - ID of the call
 * @param {string} reason - Reason for rejection
 * @returns {boolean} - Success status
 */
function rejectCall(callId, reason = 'declined') {
  const call = activeCalls.get(callId);
  if (!call) {
    console.error(`Cannot reject call: Call ${callId} not found`);
    return false;
  }
  
  call.status = 'rejected';
  call.endTime = Date.now();
  call.rejectionReason = reason;
  activeCalls.set(callId, call);
  console.log(`Call rejected: ${callId}, reason: ${reason}`);
  
  // Clean up after a delay
  setTimeout(() => {
    activeCalls.delete(callId);
  }, 60000); // Keep for 1 minute for history
  
  return true;
}

/**
 * End an active call
 * @param {string} callId - ID of the call
 * @returns {boolean} - Success status
 */
function endCall(callId) {
  const call = activeCalls.get(callId);
  if (!call) {
    console.error(`Cannot end call: Call ${callId} not found`);
    return false;
  }
  
  call.status = 'ended';
  call.endTime = Date.now();
  activeCalls.set(callId, call);
  console.log(`Call ended: ${callId}`);
  
  // Clean up after a delay
  setTimeout(() => {
    activeCalls.delete(callId);
  }, 60000); // Keep for 1 minute for history
  
  return true;
}

/**
 * Handle ICE candidate exchange
 * @param {string} callId - ID of the call
 * @param {string} senderId - ID of the sender
 * @param {Object} candidate - ICE candidate
 * @returns {boolean} - Success status
 */
function handleIceCandidate(callId, senderId, candidate) {
  const call = activeCalls.get(callId);
  if (!call) {
    console.error(`Cannot handle ICE candidate: Call ${callId} not found`);
    return false;
  }
  
  // Determine the recipient (the other party in the call)
  const recipientId = senderId === call.callerId ? call.calleeId : call.callerId;
  const recipient = getPeerById(recipientId);
  
  if (!recipient || recipient.socket.readyState !== 1) {
    console.error(`Cannot send ICE candidate: Recipient ${recipientId} not available`);
    return false;
  }
  
  // Forward the ICE candidate to the recipient
  const message = JSON.stringify({
    type: 'ice-candidate',
    callId,
    senderId,
    candidate
  });
  
  try {
    recipient.socket.send(message);
    return true;
  } catch (error) {
    console.error(`Error sending ICE candidate: ${error.message}`);
    return false;
  }
}

/**
 * Handle SDP offer/answer exchange
 * @param {string} callId - ID of the call
 * @param {string} senderId - ID of the sender
 * @param {string} sdpType - Type of SDP (offer or answer)
 * @param {Object} sdp - Session Description Protocol data
 * @returns {boolean} - Success status
 */
function handleSdpExchange(callId, senderId, sdpType, sdp) {
  const call = activeCalls.get(callId);
  if (!call) {
    console.error(`Cannot handle SDP: Call ${callId} not found`);
    return false;
  }
  
  // Determine the recipient (the other party in the call)
  const recipientId = senderId === call.callerId ? call.calleeId : call.callerId;
  const recipient = getPeerById(recipientId);
  
  if (!recipient || recipient.socket.readyState !== 1) {
    console.error(`Cannot send SDP: Recipient ${recipientId} not available`);
    return false;
  }
  
  // Forward the SDP to the recipient
  const message = JSON.stringify({
    type: 'sdp',
    callId,
    senderId,
    sdpType,
    sdp
  });
  
  try {
    recipient.socket.send(message);
    return true;
  } catch (error) {
    console.error(`Error sending SDP: ${error.message}`);
    return false;
  }
}

/**
 * Initialize a group call
 * @param {string} groupId - ID of the group
 * @param {string} initiatorId - ID of the call initiator
 * @param {boolean} withVideo - Whether to include video
 * @returns {string} - Group call ID
 */
function initiateGroupCall(groupId, initiatorId, withVideo = false) {
  const groupCallId = `group-${groupId}-${Date.now()}`;
  
  groupCalls.set(groupCallId, {
    groupCallId,
    groupId,
    initiatorId,
    withVideo,
    status: 'initiating',
    startTime: Date.now(),
    endTime: null,
    participants: [initiatorId], // Initiator is the first participant
    connections: {} // Will store peer connections between participants
  });
  
  console.log(`Group call initiated: ${groupCallId} in group ${groupId} by ${initiatorId}`);
  return groupCallId;
}

/**
 * Join a group call
 * @param {string} groupCallId - ID of the group call
 * @param {string} participantId - ID of the participant joining
 * @returns {boolean} - Success status
 */
function joinGroupCall(groupCallId, participantId) {
  const groupCall = groupCalls.get(groupCallId);
  if (!groupCall) {
    console.error(`Cannot join group call: Group call ${groupCallId} not found`);
    return false;
  }
  
  // Check if user is already in the call
  if (groupCall.participants.includes(participantId)) {
    console.log(`Participant ${participantId} is already in group call ${groupCallId}`);
    return true;
  }
  
  // Check if user is a member of the group
  if (!isGroupMember(groupCall.groupId, participantId)) {
    console.error(`Cannot join group call: User ${participantId} is not a member of group ${groupCall.groupId}`);
    return false;
  }
  
  // Add participant to the call
  groupCall.participants.push(participantId);
  groupCalls.set(groupCallId, groupCall);
  
  console.log(`Participant ${participantId} joined group call ${groupCallId}`);
  
  // Notify other participants about the new joiner
  notifyGroupCallParticipantJoined(groupCallId, participantId);
  
  return true;
}

/**
 * Leave a group call
 * @param {string} groupCallId - ID of the group call
 * @param {string} participantId - ID of the participant leaving
 * @returns {boolean} - Success status
 */
function leaveGroupCall(groupCallId, participantId) {
  const groupCall = groupCalls.get(groupCallId);
  if (!groupCall) {
    console.error(`Cannot leave group call: Group call ${groupCallId} not found`);
    return false;
  }
  
  // Remove participant from the call
  groupCall.participants = groupCall.participants.filter(id => id !== participantId);
  
  // If no participants left, end the call
  if (groupCall.participants.length === 0) {
    endGroupCall(groupCallId);
    return true;
  }
  
  groupCalls.set(groupCallId, groupCall);
  console.log(`Participant ${participantId} left group call ${groupCallId}`);
  
  // Notify other participants
  notifyGroupCallParticipantLeft(groupCallId, participantId);
  
  return true;
}

/**
 * End a group call
 * @param {string} groupCallId - ID of the group call
 * @returns {boolean} - Success status
 */
function endGroupCall(groupCallId) {
  const groupCall = groupCalls.get(groupCallId);
  if (!groupCall) {
    console.error(`Cannot end group call: Group call ${groupCallId} not found`);
    return false;
  }
  
  groupCall.status = 'ended';
  groupCall.endTime = Date.now();
  groupCalls.set(groupCallId, groupCall);
  
  // Notify all participants that the call has ended
  notifyGroupCallEnded(groupCallId);
  
  console.log(`Group call ended: ${groupCallId}`);
  
  // Clean up after a delay
  setTimeout(() => {
    groupCalls.delete(groupCallId);
  }, 60000); // Keep for 1 minute for history
  
  return true;
}

/**
 * Handle group call ICE candidate exchange
 * @param {string} groupCallId - ID of the group call
 * @param {string} senderId - ID of the sender
 * @param {string} recipientId - ID of the recipient
 * @param {Object} candidate - ICE candidate
 * @returns {boolean} - Success status
 */
function handleGroupIceCandidate(groupCallId, senderId, recipientId, candidate) {
  const groupCall = groupCalls.get(groupCallId);
  if (!groupCall) {
    console.error(`Cannot handle group ICE candidate: Group call ${groupCallId} not found`);
    return false;
  }
  
  // Check if both sender and recipient are participants
  if (!groupCall.participants.includes(senderId) || !groupCall.participants.includes(recipientId)) {
    console.error(`Invalid participants in ICE exchange: sender=${senderId}, recipient=${recipientId}`);
    return false;
  }
  
  const recipient = getPeerById(recipientId);
  if (!recipient || recipient.socket.readyState !== 1) {
    console.error(`Cannot send ICE candidate: Recipient ${recipientId} not available`);
    return false;
  }
  
  // Forward the ICE candidate to the recipient
  const message = JSON.stringify({
    type: 'group-ice-candidate',
    groupCallId,
    senderId,
    candidate
  });
  
  try {
    recipient.socket.send(message);
    return true;
  } catch (error) {
    console.error(`Error sending group ICE candidate: ${error.message}`);
    return false;
  }
}

/**
 * Handle group call SDP offer/answer exchange
 * @param {string} groupCallId - ID of the group call
 * @param {string} senderId - ID of the sender
 * @param {string} recipientId - ID of the recipient
 * @param {string} sdpType - Type of SDP (offer or answer)
 * @param {Object} sdp - Session Description Protocol data
 * @returns {boolean} - Success status
 */
function handleGroupSdpExchange(groupCallId, senderId, recipientId, sdpType, sdp) {
  const groupCall = groupCalls.get(groupCallId);
  if (!groupCall) {
    console.error(`Cannot handle group SDP: Group call ${groupCallId} not found`);
    return false;
  }
  
  // Check if both sender and recipient are participants
  if (!groupCall.participants.includes(senderId) || !groupCall.participants.includes(recipientId)) {
    console.error(`Invalid participants in SDP exchange: sender=${senderId}, recipient=${recipientId}`);
    return false;
  }
  
  const recipient = getPeerById(recipientId);
  if (!recipient || recipient.socket.readyState !== 1) {
    console.error(`Cannot send SDP: Recipient ${recipientId} not available`);
    return false;
  }
  
  // Forward the SDP to the recipient
  const message = JSON.stringify({
    type: 'group-sdp',
    groupCallId,
    senderId,
    sdpType,
    sdp
  });
  
  try {
    recipient.socket.send(message);
    return true;
  } catch (error) {
    console.error(`Error sending group SDP: ${error.message}`);
    return false;
  }
}

/**
 * Notify all participants that a new participant has joined
 * @param {string} groupCallId - ID of the group call
 * @param {string} joinerId - ID of the participant who joined
 */
function notifyGroupCallParticipantJoined(groupCallId, joinerId) {
  const groupCall = groupCalls.get(groupCallId);
  if (!groupCall) return;
  
  const message = JSON.stringify({
    type: 'group-call-participant-joined',
    groupCallId,
    participantId: joinerId
  });
  
  // Send to all participants except the joiner
  groupCall.participants.forEach(participantId => {
    if (participantId !== joinerId) {
      const participant = getPeerById(participantId);
      if (participant && participant.socket.readyState === 1) {
        participant.socket.send(message);
      }
    }
  });
}

/**
 * Notify all participants that a participant has left
 * @param {string} groupCallId - ID of the group call
 * @param {string} leaverId - ID of the participant who left
 */
function notifyGroupCallParticipantLeft(groupCallId, leaverId) {
  const groupCall = groupCalls.get(groupCallId);
  if (!groupCall) return;
  
  const message = JSON.stringify({
    type: 'group-call-participant-left',
    groupCallId,
    participantId: leaverId
  });
  
  // Send to all remaining participants
  groupCall.participants.forEach(participantId => {
    const participant = getPeerById(participantId);
    if (participant && participant.socket.readyState === 1) {
      participant.socket.send(message);
    }
  });
}

/**
 * Notify all participants that the group call has ended
 * @param {string} groupCallId - ID of the group call
 */
function notifyGroupCallEnded(groupCallId) {
  const groupCall = groupCalls.get(groupCallId);
  if (!groupCall) return;
  
  const message = JSON.stringify({
    type: 'group-call-ended',
    groupCallId
  });
  
  // Send to all participants
  groupCall.participants.forEach(participantId => {
    const participant = getPeerById(participantId);
    if (participant && participant.socket.readyState === 1) {
      participant.socket.send(message);
    }
  });
}

/**
 * Get active calls for a user
 * @param {string} userId - ID of the user
 * @returns {Array} - Array of active calls
 */
function getUserActiveCalls(userId) {
  const userCalls = [];
  
  // Check individual calls
  activeCalls.forEach(call => {
    if ((call.callerId === userId || call.calleeId === userId) && call.status === 'active') {
      userCalls.push(call);
    }
  });
  
  // Check group calls
  groupCalls.forEach(groupCall => {
    if (groupCall.participants.includes(userId) && groupCall.status === 'active') {
      userCalls.push(groupCall);
    }
  });
  
  return userCalls;
}

/**
 * Get all active group calls for a group
 * @param {string} groupId - ID of the group
 * @returns {Array} - Array of active group calls
 */
function getGroupActiveCalls(groupId) {
  const calls = [];
  
  groupCalls.forEach(groupCall => {
    if (groupCall.groupId === groupId && groupCall.status === 'active') {
      calls.push(groupCall);
    }
  });
  
  return calls;
}

module.exports = {
  // Individual call functions
  initiateCall,
  acceptCall,
  rejectCall,
  endCall,
  handleIceCandidate,
  handleSdpExchange,
  
  // Group call functions
  initiateGroupCall,
  joinGroupCall,
  leaveGroupCall,
  endGroupCall,
  handleGroupIceCandidate,
  handleGroupSdpExchange,
  
  // Utility functions
  getUserActiveCalls,
  getGroupActiveCalls
};
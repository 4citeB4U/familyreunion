// WebRTC Service Part 2 - Additional methods for LEEWAYWebRTCClient
// This file continues the implementation of the WebRTC service

import { rtdb, rtdbHelpers, authHelpers } from './firebase-config.js';

// These methods would be part of the LEEWAYWebRTCClient class
// They are separated here for clarity

/**
 * Create a data channel for messaging
 * @param {string} userId - ID of the remote user
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @private
 */
LEEWAYWebRTCClient.prototype._createDataChannel = function(userId, peerConnection) {
  try {
    // Create a data channel for secure messaging
    const dataChannel = peerConnection.createDataChannel('secure-messages', {
      ordered: true,
      maxRetransmits: 10
    });
    
    // Set up data channel
    this._setupDataChannel(userId, dataChannel);
    
    // Store the data channel
    this.dataChannels[userId] = dataChannel;
  } catch (error) {
    console.error('Error creating data channel:', error);
  }
};

/**
 * Set up data channel event handlers
 * @param {string} userId - ID of the remote user
 * @param {RTCDataChannel} dataChannel - The data channel
 * @private
 */
LEEWAYWebRTCClient.prototype._setupDataChannel = function(userId, dataChannel) {
  // Set up data channel event handlers
  dataChannel.onopen = () => {
    console.log(`Data channel opened with ${userId}`);
  };
  
  dataChannel.onclose = () => {
    console.log(`Data channel closed with ${userId}`);
    delete this.dataChannels[userId];
  };
  
  dataChannel.onmessage = (event) => {
    try {
      // Parse the message
      const message = JSON.parse(event.data);
      
      // Call message callback
      if (this.onMessageCallback) {
        this.onMessageCallback(userId, message);
      }
    } catch (error) {
      console.error('Error handling data channel message:', error);
    }
  };
};

/**
 * Send an ICE candidate to a peer
 * @param {string} userId - ID of the remote user
 * @param {RTCIceCandidate} candidate - The ICE candidate
 * @private
 */
LEEWAYWebRTCClient.prototype._sendIceCandidate = function(userId, candidate) {
  try {
    // Get current user
    const currentUser = authHelpers.getCurrentUser();
    if (!currentUser) {
      console.error('No current user');
      return;
    }
    
    // Send the ICE candidate to the remote peer via Firebase
    rtdbHelpers.pushData(`calls/${userId}/candidates/${currentUser.uid}`, {
      candidate: candidate.toJSON(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error sending ICE candidate:', error);
  }
};

/**
 * Restart ICE connection for a peer
 * @param {string} userId - ID of the remote user
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @private
 */
LEEWAYWebRTCClient.prototype._restartIce = function(userId, peerConnection) {
  console.log(`Attempting to restart ICE for peer ${userId}`);
  
  try {
    // For modern browsers that support restartIce()
    if (peerConnection.restartIce) {
      peerConnection.restartIce();
      console.log(`ICE restart initiated for peer ${userId}`);
      return;
    }
    
    // Fallback for browsers that don't support restartIce()
    // Create a new offer with ICE restart flag
    const offerOptions = {
      iceRestart: true
    };
    
    peerConnection.createOffer(offerOptions)
      .then(offer => {
        return peerConnection.setLocalDescription(offer);
      })
      .then(() => {
        // Send the offer to the remote peer
        this._sendSignalingMessage(userId, {
          type: 'offer',
          sdp: peerConnection.localDescription
        });
        console.log(`ICE restart offer sent to peer ${userId}`);
      })
      .catch(error => {
        console.error('Error creating ICE restart offer:', error);
      });
  } catch (error) {
    console.error('Error restarting ICE:', error);
  }
};

/**
 * Send a signaling message to a peer
 * @param {string} userId - ID of the remote user
 * @param {object} message - The signaling message
 * @private
 */
LEEWAYWebRTCClient.prototype._sendSignalingMessage = function(userId, message) {
  try {
    // Get current user
    const currentUser = authHelpers.getCurrentUser();
    if (!currentUser) {
      console.error('No current user');
      return;
    }
    
    // Send the signaling message to the remote peer via Firebase
    rtdbHelpers.pushData(`calls/${userId}/signaling/${currentUser.uid}`, {
      ...message,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error sending signaling message:', error);
  }
};

/**
 * Create and send an offer to a peer
 * @param {string} userId - ID of the remote user
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @private
 */
LEEWAYWebRTCClient.prototype._createAndSendOffer = function(userId, peerConnection) {
  peerConnection.createOffer()
    .then(offer => {
      return peerConnection.setLocalDescription(offer);
    })
    .then(() => {
      this._sendSignalingMessage(userId, {
        type: 'offer',
        sdp: peerConnection.localDescription
      });
    })
    .catch(error => {
      console.error('Error creating offer:', error);
    });
};

/**
 * Handle an offer from a peer
 * @param {string} userId - ID of the remote user
 * @param {RTCSessionDescription} offer - The offer
 * @private
 */
LEEWAYWebRTCClient.prototype._handleOffer = function(userId, offer) {
  try {
    // Create peer connection if it doesn't exist
    const peerConnection = this.peerConnections[userId] || this._createPeerConnection(userId, false);
    
    // Set remote description
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
      .then(() => {
        // Create answer
        return peerConnection.createAnswer();
      })
      .then(answer => {
        // Set local description
        return peerConnection.setLocalDescription(answer);
      })
      .then(() => {
        // Send answer to peer
        this._sendSignalingMessage(userId, {
          type: 'answer',
          sdp: peerConnection.localDescription
        });
      })
      .catch(error => {
        console.error('Error handling offer:', error);
      });
  } catch (error) {
    console.error('Error handling offer:', error);
  }
};

/**
 * Handle an answer from a peer
 * @param {string} userId - ID of the remote user
 * @param {RTCSessionDescription} answer - The answer
 * @private
 */
LEEWAYWebRTCClient.prototype._handleAnswer = function(userId, answer) {
  try {
    // Get peer connection
    const peerConnection = this.peerConnections[userId];
    if (!peerConnection) {
      console.error(`No peer connection for ${userId}`);
      return;
    }
    
    // Set remote description
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
      .catch(error => {
        console.error('Error setting remote description:', error);
      });
  } catch (error) {
    console.error('Error handling answer:', error);
  }
};

/**
 * Handle an ICE candidate from a peer
 * @param {string} userId - ID of the remote user
 * @param {RTCIceCandidate} candidate - The ICE candidate
 * @private
 */
LEEWAYWebRTCClient.prototype._handleIceCandidate = function(userId, candidate) {
  try {
    // Get peer connection
    const peerConnection = this.peerConnections[userId];
    if (!peerConnection) {
      console.error(`No peer connection for ${userId}`);
      return;
    }
    
    // Add ICE candidate
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      .catch(error => {
        console.error('Error adding ICE candidate:', error);
      });
  } catch (error) {
    console.error('Error handling ICE candidate:', error);
  }
};

// Public methods would be implemented in the next file
// For brevity, we'll continue in the next file

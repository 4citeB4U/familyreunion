// WebRTC Service Part 3 - Public methods for LEEWAYWebRTCClient
// This file completes the implementation of the WebRTC service

import { rtdb, rtdbHelpers, authHelpers } from './firebase-config.js';

// These methods would be part of the LEEWAYWebRTCClient class
// They are separated here for clarity

/**
 * Connect to the signaling server and initialize WebRTC
 * @returns {Promise<void>} A promise that resolves when connected
 */
LEEWAYWebRTCClient.prototype.connect = async function() {
  try {
    // Check if already connected
    if (this.connected) {
      console.log('Already connected');
      return;
    }
    
    // Sign in anonymously if not already signed in
    const currentUser = authHelpers.getCurrentUser();
    if (!currentUser) {
      await authHelpers.signInAnonymously();
    }
    
    // Set up presence
    this._setupPresence();
    
    // Set up signaling
    this._setupSignaling();
    
    // Set connected state
    this.connected = true;
    
    // Call connection status change callback
    if (this.onConnectionStatusChangeCallback) {
      this.onConnectionStatusChangeCallback('connected');
    }
    
    console.log('Connected to signaling server');
  } catch (error) {
    console.error('Error connecting to signaling server:', error);
    
    // Call connection status change callback
    if (this.onConnectionStatusChangeCallback) {
      this.onConnectionStatusChangeCallback('failed');
    }
    
    throw error;
  }
};

/**
 * Disconnect from the signaling server and clean up WebRTC connections
 */
LEEWAYWebRTCClient.prototype.disconnect = function() {
  try {
    // Close all peer connections
    Object.keys(this.peerConnections).forEach(userId => {
      this.peerConnections[userId].close();
    });
    
    // Clear peer connections
    this.peerConnections = {};
    
    // Clear data channels
    this.dataChannels = {};
    
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    // Clear audio detection interval
    if (this.audioDetectionInterval) {
      clearInterval(this.audioDetectionInterval);
      this.audioDetectionInterval = null;
    }
    
    // Set disconnected state
    this.connected = false;
    
    // Call connection status change callback
    if (this.onConnectionStatusChangeCallback) {
      this.onConnectionStatusChangeCallback('disconnected');
    }
    
    console.log('Disconnected from signaling server');
  } catch (error) {
    console.error('Error disconnecting from signaling server:', error);
  }
};

/**
 * Set up presence monitoring
 * @private
 */
LEEWAYWebRTCClient.prototype._setupPresence = function() {
  try {
    // Get current user
    const currentUser = authHelpers.getCurrentUser();
    if (!currentUser) {
      console.error('No current user');
      return;
    }
    
    // Set up presence
    const presenceRef = rtdb.ref(`presence/${currentUser.uid}`);
    
    // Set online status
    rtdbHelpers.setData(`presence/${currentUser.uid}`, {
      online: true,
      lastSeen: new Date().toISOString()
    });
    
    // Set up disconnect handler
    presenceRef.onDisconnect().update({
      online: false,
      lastSeen: new Date().toISOString()
    });
    
    // Listen for other users' presence
    rtdbHelpers.onValueListener('presence', (presenceData) => {
      if (!presenceData) return;
      
      // Process presence data
      Object.keys(presenceData).forEach(userId => {
        if (userId === currentUser.uid) return;
        
        const userData = presenceData[userId];
        
        // Check if user joined
        if (userData.online && !this.peerConnections[userId]) {
          // Call user joined callback
          if (this.onUserJoinedCallback) {
            this.onUserJoinedCallback(userId, 'group');
          }
        }
        
        // Check if user left
        if (!userData.online && this.peerConnections[userId]) {
          // Close peer connection
          this.peerConnections[userId].close();
          delete this.peerConnections[userId];
          
          // Call user left callback
          if (this.onUserLeftCallback) {
            this.onUserLeftCallback(userId);
          }
        }
      });
    });
  } catch (error) {
    console.error('Error setting up presence:', error);
  }
};

/**
 * Set up signaling
 * @private
 */
LEEWAYWebRTCClient.prototype._setupSignaling = function() {
  try {
    // Get current user
    const currentUser = authHelpers.getCurrentUser();
    if (!currentUser) {
      console.error('No current user');
      return;
    }
    
    // Listen for signaling messages
    rtdbHelpers.onValueListener(`calls/${currentUser.uid}/signaling`, (signalingData) => {
      if (!signalingData) return;
      
      // Process signaling data
      Object.keys(signalingData).forEach(userId => {
        const messages = signalingData[userId];
        
        // Process each message
        Object.keys(messages).forEach(messageId => {
          const message = messages[messageId];
          
          // Handle different message types
          switch (message.type) {
            case 'offer':
              this._handleOffer(userId, message.sdp);
              break;
              
            case 'answer':
              this._handleAnswer(userId, message.sdp);
              break;
              
            default:
              console.warn(`Unknown signaling message type: ${message.type}`);
          }
        });
      });
    });
    
    // Listen for ICE candidates
    rtdbHelpers.onValueListener(`calls/${currentUser.uid}/candidates`, (candidatesData) => {
      if (!candidatesData) return;
      
      // Process candidates data
      Object.keys(candidatesData).forEach(userId => {
        const candidates = candidatesData[userId];
        
        // Process each candidate
        Object.keys(candidates).forEach(candidateId => {
          const candidateData = candidates[candidateId];
          
          // Handle ICE candidate
          this._handleIceCandidate(userId, candidateData.candidate);
        });
      });
    });
  } catch (error) {
    console.error('Error setting up signaling:', error);
  }
};

/**
 * Set the local media stream
 * @param {MediaStream} stream - The local media stream
 */
LEEWAYWebRTCClient.prototype.setLocalStream = function(stream) {
  try {
    // Stop existing stream if any
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    
    // Set new stream
    this.localStream = stream;
    
    // Add tracks to existing peer connections
    Object.keys(this.peerConnections).forEach(userId => {
      const peerConnection = this.peerConnections[userId];
      
      // Remove existing senders
      const senders = peerConnection.getSenders();
      senders.forEach(sender => {
        peerConnection.removeTrack(sender);
      });
      
      // Add new tracks
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });
    });
    
    // Set up audio level detection
    this._setupAudioLevelDetection(stream, true);
  } catch (error) {
    console.error('Error setting local stream:', error);
  }
};

/**
 * Initiate a call to a user
 * @param {string} userId - ID of the user to call
 * @param {MediaStream} [stream] - The local media stream (optional)
 */
LEEWAYWebRTCClient.prototype.initiateCall = function(userId, stream) {
  try {
    // Set local stream if provided
    if (stream) {
      this.setLocalStream(stream);
    }
    
    // Create peer connection
    const peerConnection = this._createPeerConnection(userId, true);
    
    // Create and send offer
    this._createAndSendOffer(userId, peerConnection);
  } catch (error) {
    console.error('Error initiating call:', error);
  }
};

/**
 * Send a message to a user
 * @param {string} userId - ID of the user to send the message to
 * @param {object} message - The message to send
 * @returns {boolean} Whether the message was sent successfully
 */
LEEWAYWebRTCClient.prototype.sendMessage = function(userId, message) {
  try {
    // Get data channel
    const dataChannel = this.dataChannels[userId];
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.error(`No open data channel for ${userId}`);
      return false;
    }
    
    // Add timestamp and sender ID
    const messageWithMetadata = {
      ...message,
      timestamp: new Date().toISOString(),
      senderId: this.sessionId
    };
    
    // Send message
    dataChannel.send(JSON.stringify(messageWithMetadata));
    return true;
  } catch (error) {
    console.error('Error sending message:', error);
    return false;
  }
};

// Callback setters
LEEWAYWebRTCClient.prototype.onConnectionStatusChange = function(callback) {
  this.onConnectionStatusChangeCallback = callback;
};

LEEWAYWebRTCClient.prototype.onUserJoined = function(callback) {
  this.onUserJoinedCallback = callback;
};

LEEWAYWebRTCClient.prototype.onUserLeft = function(callback) {
  this.onUserLeftCallback = callback;
};

LEEWAYWebRTCClient.prototype.onMessage = function(callback) {
  this.onMessageCallback = callback;
};

LEEWAYWebRTCClient.prototype.onTrack = function(callback) {
  this.onTrackCallback = callback;
};

LEEWAYWebRTCClient.prototype.onSpeaking = function(callback) {
  this.onSpeakingCallback = callback;
};

// Export the complete LEEWAYWebRTCClient
export { LEEWAYWebRTCClient };

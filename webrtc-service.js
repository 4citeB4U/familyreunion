// WebRTC Service following LEEWAY standards
// This file provides WebRTC functionality for video and voice chat

import { rtdb, rtdbHelpers, authHelpers } from './firebase-config.js';

/**
 * LEEWAY WebRTC Client
 * Handles WebRTC connection establishment, ICE candidate exchange,
 * encrypted signaling, and connection state monitoring.
 */
class LEEWAYWebRTCClient {
  constructor() {
    // WebRTC connections
    this.peerConnections = {}; // userId -> RTCPeerConnection
    this.localStream = null;
    
    // Enhanced ICE servers configuration with reliable STUN/TURN servers
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.stunprotocol.org:3478' },
      { urls: 'stun:global.stun.twilio.com:3478?transport=udp' },
      // TURN servers would be configured in production with proper credentials
      {
        urls: 'turn:numb.viagenie.ca',
        username: 'webrtc@live.com',
        credential: 'muazkh'
      },
      {
        urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
        username: 'webrtc',
        credential: 'webrtc'
      }
    ];
    
    // Connection state
    this.connected = false;
    
    // LEEWAY system info
    this.systemName = 'LEEWAY WebRTC';
    this.systemVersion = '5.1';
    
    // Secure communication
    this.sessionId = this._generateSessionId();
    this.dataChannels = {}; // userId -> RTCDataChannel
    
    // Audio level detection
    this.audioContext = null;
    this.audioAnalyser = null;
    this.audioDataArray = null;
    this.audioDetectionInterval = null;
    this.speakingThreshold = 15; // Threshold for speaking detection
    
    // Callbacks
    this.onConnectionStatusChangeCallback = null;
    this.onUserJoinedCallback = null;
    this.onUserLeftCallback = null;
    this.onMessageCallback = null;
    this.onTrackCallback = null;
    this.onSpeakingCallback = null;
    
    // Initialize audio context for speaking detection
    this._initAudioContext();
  }
  
  /**
   * Generate a cryptographically secure random session ID
   * @returns {string} A secure random session ID
   * @private
   */
  _generateSessionId() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * Initialize audio context for speaking detection
   * @private
   */
  _initAudioContext() {
    try {
      // Check if AudioContext is supported
      if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContextClass();
        console.log('Audio context initialized for speaking detection');
      } else {
        console.warn('AudioContext not supported in this browser');
      }
    } catch (error) {
      console.error('Error initializing audio context:', error);
    }
  }
  
  /**
   * Set up audio level detection for a stream
   * @param {MediaStream} stream - The media stream to monitor
   * @param {boolean} isLocal - Whether this is the local stream
   * @private
   */
  _setupAudioLevelDetection(stream, isLocal) {
    if (!this.audioContext || !stream) return;
    
    try {
      // Get audio track
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;
      
      // Create media stream source
      const source = this.audioContext.createMediaStreamSource(stream);
      
      // Create analyser
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      // Create data array
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      // Set up detection interval
      const userId = isLocal ? 'local' : 'remote';
      
      // Clear existing interval if any
      if (this.audioDetectionInterval) {
        clearInterval(this.audioDetectionInterval);
      }
      
      this.audioDetectionInterval = setInterval(() => {
        // Get audio data
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        // Determine if speaking
        const isSpeaking = average > this.speakingThreshold;
        
        // Call callback if set
        if (this.onSpeakingCallback) {
          this.onSpeakingCallback(userId, isSpeaking, average);
        }
      }, 100);
    } catch (error) {
      console.error('Error setting up audio level detection:', error);
    }
  }
  
  /**
   * Create a new RTCPeerConnection
   * @param {string} userId - ID of the remote user
   * @param {boolean} isInitiator - Whether this client is initiating the connection
   * @private
   */
  _createPeerConnection(userId, isInitiator) {
    try {
      // Close existing connection if any
      if (this.peerConnections[userId]) {
        this.peerConnections[userId].close();
      }
      
      // Create new connection with enhanced ICE server configuration
      const peerConnection = new RTCPeerConnection({
        iceServers: this.iceServers,
        iceTransportPolicy: 'all', // Use 'relay' to force TURN usage
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        sdpSemantics: 'unified-plan'
      });
      
      // Add local tracks to the connection
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, this.localStream);
        });
        
        // Set up audio level detection for local stream
        this._setupAudioLevelDetection(this.localStream, true);
      }
      
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this._sendIceCandidate(userId, event.candidate);
        }
      };
      
      // Monitor ICE connection state
      peerConnection.oniceconnectionstatechange = () => {
        console.log(`ICE connection state for ${userId}: ${peerConnection.iceConnectionState}`);
        
        // Handle different ICE connection states
        switch (peerConnection.iceConnectionState) {
          case 'failed':
            console.error(`ICE connection failed for peer ${userId}`);
            // Attempt to restart ICE
            this._restartIce(userId, peerConnection);
            break;
            
          case 'disconnected':
            console.warn(`ICE connection disconnected for peer ${userId}`);
            // Wait briefly to see if it reconnects automatically
            setTimeout(() => {
              if (peerConnection.iceConnectionState === 'disconnected') {
                this._restartIce(userId, peerConnection);
              }
            }, 5000);
            break;
            
          case 'connected':
          case 'completed':
            console.log(`ICE connection established for peer ${userId}`);
            break;
        }
        
        // Call connection status change callback
        if (this.onConnectionStatusChangeCallback) {
          this.onConnectionStatusChangeCallback(peerConnection.iceConnectionState);
        }
      };
      
      // Handle remote tracks
      peerConnection.ontrack = (event) => {
        console.log(`Received remote track from ${userId}:`, event.track.kind);
        
        // Create a new stream with all tracks
        const remoteStream = new MediaStream();
        event.streams[0].getTracks().forEach(track => {
          remoteStream.addTrack(track);
        });
        
        // Set up audio level detection for remote stream
        this._setupAudioLevelDetection(remoteStream, false);
        
        // Call track callback
        if (this.onTrackCallback) {
          this.onTrackCallback(userId, remoteStream);
        }
      };
      
      // Create data channel for messaging
      if (isInitiator) {
        this._createDataChannel(userId, peerConnection);
      } else {
        peerConnection.ondatachannel = (event) => {
          console.log(`Received data channel from ${userId}`);
          this.dataChannels[userId] = event.channel;
          this._setupDataChannel(userId, event.channel);
        };
      }
      
      // Store the peer connection
      this.peerConnections[userId] = peerConnection;
      
      return peerConnection;
    } catch (error) {
      console.error('Error creating peer connection:', error);
      throw error;
    }
  }
  
  // Additional methods would be implemented here
  // For brevity, we'll continue in the next file
}

// Export the LEEWAY WebRTC client
export { LEEWAYWebRTCClient };

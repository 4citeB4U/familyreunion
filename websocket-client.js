// WebSocket client for real-time communication
class WebSocketClient {
  constructor() {
    this.socket = null;
    this.userId = null;
    this.currentRoomId = null;
    this.peerConnections = {};
    this.localStream = null;
    this.onUserJoinedCallback = null;
    this.onTextMessageCallback = null;
    this.onConnectionStatusChangeCallback = null;
    this.onTrackCallback = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectTimer = null;
    this.isConnecting = false;
    this.serverUrl = 'ws://localhost:8080';
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnecting) {
        console.log('Connection already in progress');
        return reject(new Error('Connection already in progress'));
      }

      this.isConnecting = true;

      try {
        console.log(`Connecting to WebSocket server: ${this.serverUrl}`);
        this.socket = new WebSocket(this.serverUrl);

        this.socket.onopen = () => {
          console.log('WebSocket connection established');
          this.isConnecting = false;
          this.reconnectAttempts = 0;

          // Start heartbeat to keep connection alive
          this.startHeartbeat();

          if (this.onConnectionStatusChangeCallback) {
            this.onConnectionStatusChangeCallback('connected');
          }
          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;

          if (this.onConnectionStatusChangeCallback) {
            this.onConnectionStatusChangeCallback('error');
          }

          reject(error);
        };

        this.socket.onclose = (event) => {
          console.log(`WebSocket connection closed: ${event.code} ${event.reason || ''}`);
          this.isConnecting = false;

          if (this.onConnectionStatusChangeCallback) {
            this.onConnectionStatusChangeCallback('disconnected');
          }

          // Attempt to reconnect unless this was a clean close
          if (event.code !== 1000 && event.code !== 1001) {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        console.error('Error connecting to WebSocket server:', error);
        this.isConnecting = false;

        if (this.onConnectionStatusChangeCallback) {
          this.onConnectionStatusChangeCallback('error');
        }

        reject(error);
      }
    });
  }

  // Attempt to reconnect with exponential backoff
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Maximum reconnection attempts reached');
      return;
    }

    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);

      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  // Send periodic pings to keep the connection alive
  startHeartbeat() {
    // Clear any existing heartbeat interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Send a ping every 20 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ action: 'ping' }));
      }
    }, 20000);
  }

  handleMessage(data) {
    switch (data.type) {
      case 'connection':
        this.userId = data.userId;
        console.log('Connected with user ID:', this.userId);
        break;

      case 'roomCreated':
        this.currentRoomId = data.roomId;
        console.log('Room created with ID:', this.currentRoomId);
        break;

      case 'userJoined':
        console.log('User joined:', data.userId);
        if (this.onUserJoinedCallback) {
          this.onUserJoinedCallback(data.userId, data.roomType);
        }
        break;

      case 'signal':
        this.handleSignalingData(data);
        break;

      case 'textMessage':
        console.log('Text message received:', data.message);
        if (this.onTextMessageCallback) {
          this.onTextMessageCallback(data.from, data.message);
        }
        break;
    }
  }

  handleSignalingData(data) {
    const { from, signal } = data;
    console.log('Received signaling data from', from, 'signal type:', signal.type);

    if (!this.peerConnections[from]) {
      // Create a new RTCPeerConnection for this user
      this.createPeerConnection(from);
    }

    const peerConnection = this.peerConnections[from];

    if (signal.type === 'offer') {
      console.log('Processing offer from', from);

      peerConnection.setRemoteDescription(new RTCSessionDescription(signal))
        .then(() => {
          console.log('Remote description set successfully for offer');
          return peerConnection.createAnswer();
        })
        .then(answer => {
          console.log('Created answer:', answer);
          return peerConnection.setLocalDescription(answer);
        })
        .then(() => {
          console.log('Local description set, sending answer to', from);
          this.sendSignal(from, peerConnection.localDescription);
        })
        .catch(error => {
          console.error('Error handling offer:', error);
          // Try to recover by restarting the connection
          this.recoverConnection(from);
        });
    } else if (signal.type === 'answer') {
      console.log('Processing answer from', from);

      peerConnection.setRemoteDescription(new RTCSessionDescription(signal))
        .then(() => {
          console.log('Remote description set successfully for answer');
        })
        .catch(error => {
          console.error('Error handling answer:', error);
          // Try to recover by restarting the connection
          this.recoverConnection(from);
        });
    } else if (signal.type === 'candidate') {
      console.log('Processing ICE candidate from', from);

      // Only add the candidate if we have a remote description
      if (peerConnection.remoteDescription) {
        peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate))
          .then(() => {
            console.log('Added ICE candidate successfully');
          })
          .catch(error => {
            console.error('Error adding ICE candidate:', error);
          });
      } else {
        console.warn('Received ICE candidate before remote description, queueing...');
        // Queue the candidate to be added later
        setTimeout(() => {
          if (peerConnection.remoteDescription) {
            peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate))
              .catch(error => console.error('Error adding delayed ICE candidate:', error));
          }
        }, 1000);
      }
    }
  }

  // Helper method to recover from connection errors
  recoverConnection(userId) {
    console.log('Attempting to recover connection with', userId);

    // Close the existing connection
    if (this.peerConnections[userId]) {
      this.peerConnections[userId].close();
      delete this.peerConnections[userId];
    }

    // Create a new connection
    const newConnection = this.createPeerConnection(userId);

    // If we have a local stream, add it to the new connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        newConnection.addTrack(track, this.localStream);
      });

      // Create a new offer
      newConnection.createOffer()
        .then(offer => newConnection.setLocalDescription(offer))
        .then(() => {
          this.sendSignal(userId, newConnection.localDescription);
        })
        .catch(error => console.error('Error creating recovery offer:', error));
    }
  }

  createRoom(roomType = 'video') {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        action: 'createRoom',
        roomType
      }));
    } else {
      console.error('WebSocket not connected');
    }
  }

  joinRoom(roomId) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.currentRoomId = roomId;
      this.socket.send(JSON.stringify({
        action: 'joinRoom',
        roomId
      }));
    } else {
      console.error('WebSocket not connected');
    }
  }

  sendSignal(target, signal) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        action: 'signal',
        target,
        from: this.userId,
        signal
      }));
    } else {
      console.error('WebSocket not connected');
    }
  }

  sendTextMessage(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.currentRoomId) {
      this.socket.send(JSON.stringify({
        action: 'textMessage',
        roomId: this.currentRoomId,
        message
      }));
    } else {
      console.error('WebSocket not connected or no room joined');
    }
  }

  createPeerConnection(targetUserId) {
    console.log('Creating peer connection for user:', targetUserId);

    // Check if we're on a mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log('Device is mobile:', isMobile);

    // Enhanced ICE configuration with multiple TURN servers for better connectivity
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.stunprotocol.org:3478' },
        {
          urls: 'turn:numb.viagenie.ca:3478',
          username: 'webrtc@live.com',
          credential: 'muazkh'
        },
        {
          urls: 'turn:global.turn.twilio.com:3478?transport=udp',
          username: 'f4b4035eaa76f4a55de5f4351567653ee4ff6fa97b50b6b334fcc1be9c27212d',
          credential: 'w1WENLYwO/lUKIjjpIW6oDGQvvfPTOR8Xd2GNTp4mPQ='
        },
        {
          urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
          username: 'f4b4035eaa76f4a55de5f4351567653ee4ff6fa97b50b6b334fcc1be9c27212d',
          credential: 'w1WENLYwO/lUKIjjpIW6oDGQvvfPTOR8Xd2GNTp4mPQ='
        }
      ],
      iceCandidatePoolSize: 15,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      // Mobile-specific optimizations
      iceTransportPolicy: isMobile ? 'relay' : 'all', // Force TURN usage on mobile
      sdpSemantics: 'unified-plan'
    });

    this.peerConnections[targetUserId] = peerConnection;

    // Add transceivers for better compatibility, especially on mobile
    try {
      peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
      peerConnection.addTransceiver('video', { direction: 'sendrecv' });
      console.log('Added audio and video transceivers');
    } catch (error) {
      console.warn('Could not add transceivers, falling back to addTrack:', error);
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('New ICE candidate:', event.candidate.candidate.substr(0, 50) + '...');
        this.sendSignal(targetUserId, {
          type: 'candidate',
          candidate: event.candidate
        });
      } else {
        console.log('All ICE candidates have been gathered');
      }
    };

    // Handle ICE gathering state changes
    peerConnection.onicegatheringstatechange = () => {
      console.log(`ICE gathering state for ${targetUserId}:`, peerConnection.iceGatheringState);
    };

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${targetUserId}:`, peerConnection.iceConnectionState);

      if (peerConnection.iceConnectionState === 'failed') {
        console.warn('ICE connection failed, attempting to restart');
        peerConnection.restartIce();
      } else if (peerConnection.iceConnectionState === 'disconnected') {
        console.warn('ICE connection disconnected, monitoring for recovery');

        // Set a timer to check if we recover naturally
        setTimeout(() => {
          if (peerConnection.iceConnectionState === 'disconnected') {
            console.warn('ICE connection still disconnected after timeout, restarting');
            peerConnection.restartIce();
          }
        }, 5000);
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state for ${targetUserId}:`, peerConnection.connectionState);

      if (peerConnection.connectionState === 'connected') {
        console.log('Peer connection established successfully');

        // Log stats after connection is established
        this.logConnectionStats(peerConnection);
      } else if (peerConnection.connectionState === 'failed') {
        console.error('Peer connection failed, attempting recovery');
        this.recoverConnection(targetUserId);
      }
    };

    // Handle signaling state changes
    peerConnection.onsignalingstatechange = () => {
      console.log(`Signaling state for ${targetUserId}:`, peerConnection.signalingState);
    };

    // Handle tracks received from the peer
    peerConnection.ontrack = (event) => {
      console.log('Track received from peer:', event.track.kind);

      // The application should handle this event to display the remote stream
      if (this.onTrackCallback && event.streams && event.streams[0]) {
        this.onTrackCallback(targetUserId, event.streams[0]);
      }
    };

    return peerConnection;
  }

  // Log connection stats for debugging
  logConnectionStats(peerConnection) {
    if (!peerConnection) return;

    // Get connection stats every 5 seconds for the first minute
    let statsInterval = setInterval(() => {
      peerConnection.getStats().then(stats => {
        let usingRelay = false;
        let activeCandidatePair = null;

        stats.forEach(report => {
          if (report.type === 'transport') {
            console.log('Transport stats:', report);
          } else if (report.type === 'candidate-pair' && report.selected) {
            activeCandidatePair = report;
            console.log('Active candidate pair:', report);
          }
        });

        if (activeCandidatePair) {
          // Check if we're using a TURN relay
          stats.forEach(report => {
            if (report.id === activeCandidatePair.remoteCandidateId &&
                report.candidateType === 'relay') {
              usingRelay = true;
              console.log('Using TURN relay for connection');
            }
          });
        }

        console.log('Using TURN relay:', usingRelay);
      });
    }, 5000);

    // Clear the interval after 1 minute
    setTimeout(() => {
      clearInterval(statsInterval);
    }, 60000);
  }

  addLocalStream(stream) {
    if (!stream) return;

    console.log('Adding local stream to WebSocketClient:', stream.getTracks());

    // Store the stream for later use
    this.localStream = stream;

    // Add tracks from local stream to all peer connections
    stream.getTracks().forEach(track => {
      console.log('Adding track to all peer connections:', track.kind);
      Object.values(this.peerConnections).forEach(peerConnection => {
        // Check if the track is already added to avoid duplicates
        const senders = peerConnection.getSenders();
        const trackAlreadyAdded = senders.some(sender =>
          sender.track && sender.track.id === track.id
        );

        if (!trackAlreadyAdded) {
          peerConnection.addTrack(track, stream);
        }
      });
    });

    return this;
  }

  initiateCall(targetUserId, stream) {
    console.log(`Initiating call to user: ${targetUserId}`);

    if (!this.peerConnections[targetUserId]) {
      this.createPeerConnection(targetUserId);
    }

    const peerConnection = this.peerConnections[targetUserId];

    // Check if we're on a mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Add local stream tracks to the peer connection
    if (stream) {
      console.log('Adding local stream tracks to peer connection:', stream.getTracks());

      try {
        // Remove any existing senders to avoid duplicates
        const senders = peerConnection.getSenders();
        senders.forEach(sender => {
          if (sender.track) {
            console.log(`Removing existing track: ${sender.track.kind}`);
            peerConnection.removeTrack(sender);
          }
        });

        // Add all tracks from the stream with mobile-specific constraints
        stream.getTracks().forEach(track => {
          if (track.kind === 'audio') {
            // Apply audio constraints for better quality
            const audioConstraints = {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            };

            if (track.applyConstraints) {
              track.applyConstraints(audioConstraints)
                .catch(e => console.warn('Could not apply audio constraints:', e));
            }
          } else if (track.kind === 'video' && isMobile) {
            // Apply video constraints for mobile devices
            const videoConstraints = {
              width: { ideal: 640, max: 1280 },
              height: { ideal: 480, max: 720 },
              frameRate: { max: 24 }
            };

            if (track.applyConstraints) {
              track.applyConstraints(videoConstraints)
                .catch(e => console.warn('Could not apply video constraints:', e));
            }
          }

          console.log(`Adding ${track.kind} track to peer connection`);
          peerConnection.addTrack(track, stream);
        });
      } catch (error) {
        console.error('Error adding tracks to peer connection:', error);
      }
    } else {
      console.warn('No local stream available for call initiation');

      // Try to get the local stream if not provided
      this.getLocalMedia()
        .then(newStream => {
          console.log('Got new local stream for call initiation');
          this.localStream = newStream;
          // Retry the call with the new stream
          this.initiateCall(targetUserId, newStream);
        })
        .catch(error => {
          console.error('Failed to get local media for call:', error);
        });

      return; // Exit early, we'll retry after getting the stream
    }

    // Create and send an offer with appropriate constraints
    const offerOptions = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
      voiceActivityDetection: true,
      iceRestart: true // Enable ICE restart for better recovery
    };

    peerConnection.createOffer(offerOptions)
      .then(offer => {
        console.log('Created offer');

        // Modify SDP for better mobile compatibility if needed
        if (isMobile) {
          offer.sdp = this.modifySdpForMobile(offer.sdp);
        }

        return peerConnection.setLocalDescription(offer);
      })
      .then(() => {
        console.log('Set local description, sending signal');
        this.sendSignal(targetUserId, peerConnection.localDescription);
      })
      .catch(error => {
        console.error('Error creating offer:', error);
        // Try to recover by recreating the peer connection
        this.recoverConnection(targetUserId);
      });
  }

  // Helper method to get local media with appropriate constraints
  getLocalMedia() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Set constraints based on device type
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: isMobile ?
        {
          facingMode: 'user',
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { max: 24 }
        } :
        {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
    };

    console.log('Getting local media with constraints:', constraints);

    return navigator.mediaDevices.getUserMedia(constraints)
      .catch(error => {
        console.error('Error getting user media:', error);

        // Fall back to audio only if video fails
        if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError' ||
            error.name === 'NotReadableError' || error.name === 'OverconstrainedError') {
          console.log('Falling back to audio only');
          return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        }

        throw error;
      });
  }

  // Modify SDP for better mobile compatibility
  modifySdpForMobile(sdp) {
    // Lower video bitrate for mobile
    sdp = sdp.replace(/(m=video.*\r\n)/g, '$1b=AS:800\r\n');

    // Ensure audio is prioritized
    sdp = sdp.replace(/(m=audio.*\r\n)/g, '$1b=AS:64\r\n');

    // Prefer H.264 codec for better hardware acceleration on mobile
    const videoSection = sdp.match(/(m=video.*\r\n)([\s\S]*?)(?=m=|$)/);
    if (videoSection) {
      const lines = videoSection[0].split('\r\n');
      const h264Lines = lines.filter(line => line.includes('H264'));

      if (h264Lines.length > 0) {
        // Extract payload types
        const payloadTypes = lines[0].split(' ').slice(3);
        const h264PayloadTypes = h264Lines.map(line => {
          const match = line.match(/a=rtpmap:(\d+) H264/);
          return match ? match[1] : null;
        }).filter(Boolean);

        if (h264PayloadTypes.length > 0) {
          // Reorder payload types to prioritize H.264
          const newPayloadTypes = [...h264PayloadTypes];
          payloadTypes.forEach(pt => {
            if (!h264PayloadTypes.includes(pt)) {
              newPayloadTypes.push(pt);
            }
          });

          // Replace the m= line with reordered payload types
          const newMLine = lines[0].split(' ').slice(0, 3).concat(newPayloadTypes).join(' ');
          sdp = sdp.replace(lines[0], newMLine);
        }
      }
    }

    return sdp;
  }

  disconnect() {
    console.log('Disconnecting WebSocket client');

    // Stop all tracks in the local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        console.log(`Stopping ${track.kind} track`);
        track.stop();
      });
      this.localStream = null;
    }

    // Close all peer connections
    Object.keys(this.peerConnections).forEach(userId => {
      console.log(`Closing peer connection with ${userId}`);
      const connection = this.peerConnections[userId];

      // Remove all tracks
      const senders = connection.getSenders();
      senders.forEach(sender => {
        if (sender.track) {
          connection.removeTrack(sender);
        }
      });

      // Close the connection
      connection.close();
    });
    this.peerConnections = {};

    // Clear any pending timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Leave any current room
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.currentRoomId) {
      this.socket.send(JSON.stringify({
        action: 'leaveRoom',
        roomId: this.currentRoomId
      }));
    }

    // Close the WebSocket connection
    if (this.socket) {
      // Only close if not already closing or closed
      if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close(1000, 'Normal closure');
      }
      this.socket = null;
    }

    this.userId = null;
    this.currentRoomId = null;
    this.reconnectAttempts = 0;
    this.isConnecting = false;

    console.log('WebSocket client disconnected');
  }

  // Event handlers
  onUserJoined(callback) {
    this.onUserJoinedCallback = callback;
  }

  onTextMessage(callback) {
    this.onTextMessageCallback = callback;
  }

  onTrack(callback) {
    this.onTrackCallback = callback;
  }

  onConnectionStatusChange(callback) {
    this.onConnectionStatusChangeCallback = callback;
  }
}

// Export the WebSocketClient class
window.WebSocketClient = WebSocketClient;

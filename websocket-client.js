// WebSocket client for real-time communication
class WebSocketClient {
  constructor() {
    this.socket = null;
    this.userId = null;
    this.currentRoomId = null;
    this.peerConnections = {};
    this.onUserJoinedCallback = null;
    this.onTextMessageCallback = null;
    this.onConnectionStatusChangeCallback = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket('ws://localhost:8080');
        
        this.socket.onopen = () => {
          console.log('WebSocket connection established');
          if (this.onConnectionStatusChangeCallback) {
            this.onConnectionStatusChangeCallback('connected');
          }
          resolve();
        };
        
        this.socket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        };
        
        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (this.onConnectionStatusChangeCallback) {
            this.onConnectionStatusChangeCallback('error');
          }
          reject(error);
        };
        
        this.socket.onclose = () => {
          console.log('WebSocket connection closed');
          if (this.onConnectionStatusChangeCallback) {
            this.onConnectionStatusChangeCallback('disconnected');
          }
        };
      } catch (error) {
        console.error('Error connecting to WebSocket server:', error);
        if (this.onConnectionStatusChangeCallback) {
          this.onConnectionStatusChangeCallback('error');
        }
        reject(error);
      }
    });
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
    
    if (!this.peerConnections[from]) {
      // Create a new RTCPeerConnection for this user
      this.createPeerConnection(from);
    }
    
    const peerConnection = this.peerConnections[from];
    
    if (signal.type === 'offer') {
      peerConnection.setRemoteDescription(new RTCSessionDescription(signal))
        .then(() => peerConnection.createAnswer())
        .then(answer => peerConnection.setLocalDescription(answer))
        .then(() => {
          this.sendSignal(from, peerConnection.localDescription);
        })
        .catch(error => console.error('Error handling offer:', error));
    } else if (signal.type === 'answer') {
      peerConnection.setRemoteDescription(new RTCSessionDescription(signal))
        .catch(error => console.error('Error handling answer:', error));
    } else if (signal.type === 'candidate') {
      peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate))
        .catch(error => console.error('Error adding ice candidate:', error));
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
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });
    
    this.peerConnections[targetUserId] = peerConnection;
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(targetUserId, {
          type: 'candidate',
          candidate: event.candidate
        });
      }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state for ${targetUserId}:`, peerConnection.connectionState);
    };
    
    // Handle tracks received from the peer
    peerConnection.ontrack = (event) => {
      console.log('Track received from peer:', event.streams[0]);
      // The application should handle this event to display the remote stream
      if (this.onTrackCallback) {
        this.onTrackCallback(targetUserId, event.streams[0]);
      }
    };
    
    return peerConnection;
  }

  addLocalStream(stream) {
    if (!stream) return;
    
    // Add tracks from local stream to all peer connections
    stream.getTracks().forEach(track => {
      Object.values(this.peerConnections).forEach(peerConnection => {
        peerConnection.addTrack(track, stream);
      });
    });
  }

  initiateCall(targetUserId, stream) {
    if (!this.peerConnections[targetUserId]) {
      this.createPeerConnection(targetUserId);
    }
    
    const peerConnection = this.peerConnections[targetUserId];
    
    // Add local stream tracks to the peer connection
    if (stream) {
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });
    }
    
    // Create and send an offer
    peerConnection.createOffer()
      .then(offer => peerConnection.setLocalDescription(offer))
      .then(() => {
        this.sendSignal(targetUserId, peerConnection.localDescription);
      })
      .catch(error => console.error('Error creating offer:', error));
  }

  disconnect() {
    // Close all peer connections
    Object.values(this.peerConnections).forEach(connection => {
      connection.close();
    });
    this.peerConnections = {};
    
    // Close the WebSocket connection
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.userId = null;
    this.currentRoomId = null;
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

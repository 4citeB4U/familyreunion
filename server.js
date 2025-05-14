// === server.js ===
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Enhanced WebSocket server with stability improvements
const wss = new WebSocket.Server({
  port: 8080,
  clientTracking: true,
  perMessageDeflate: {
    zlibDeflateOptions: { level: 3 }
  }
});

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(type = 'video') {
    const roomId = uuidv4();
    this.rooms.set(roomId, { connections: new Map(), type });
    console.log(`Room created: ${roomId}, type: ${type}`);
    return roomId;
  }

  joinRoom(roomId, userId, ws) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.connections.set(userId, ws);
      console.log(`User ${userId} joined room ${roomId}`);
      return room;
    }
    console.log(`Failed to join room: ${roomId} (not found)`);
    return null;
  }

  leaveRoom(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.connections.delete(userId);
      console.log(`User ${userId} left room ${roomId}`);

      // Clean up empty rooms
      if (room.connections.size === 0) {
        this.rooms.delete(roomId);
        console.log(`Room ${roomId} deleted (empty)`);
      }
      return true;
    }
    return false;
  }

  getRoomParticipants(roomId) {
    const room = this.rooms.get(roomId);
    if (room) {
      return Array.from(room.connections.keys());
    }
    return [];
  }
}

const roomManager = new RoomManager();

wss.on('connection', (ws) => {
  const userId = uuidv4();
  let currentRoom = null;

  // Add ping-pong mechanism for connection health monitoring
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  console.log(`New connection established: ${userId}`);
  ws.send(JSON.stringify({ type: 'connection', userId }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`Received message from ${userId}: ${data.action}`);

      switch (data.action) {
        case 'createRoom': {
          const roomId = roomManager.createRoom(data.roomType);
          ws.send(JSON.stringify({
            type: 'roomCreated',
            roomId,
            timestamp: Date.now()
          }));
          break;
        }
        case 'joinRoom': {
          currentRoom = roomManager.joinRoom(data.roomId, userId, ws);
          if (currentRoom) {
            // Notify all users in the room about the new participant
            broadcastToRoom(data.roomId, {
              type: 'userJoined',
              userId,
              roomType: currentRoom.type,
              participants: roomManager.getRoomParticipants(data.roomId),
              timestamp: Date.now()
            }, userId);

            // Send the current participants to the new user
            ws.send(JSON.stringify({
              type: 'roomInfo',
              roomId: data.roomId,
              participants: roomManager.getRoomParticipants(data.roomId),
              timestamp: Date.now()
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Failed to join room',
              roomId: data.roomId,
              timestamp: Date.now()
            }));
          }
          break;
        }
        case 'leaveRoom': {
          if (currentRoom && data.roomId) {
            roomManager.leaveRoom(data.roomId, userId);
            broadcastToRoom(data.roomId, {
              type: 'userLeft',
              userId,
              timestamp: Date.now()
            });
            currentRoom = null;
          }
          break;
        }
        case 'signal': {
          if (currentRoom) {
            const target = currentRoom.connections.get(data.target);
            if (target && target.readyState === WebSocket.OPEN) {
              console.log(`Forwarding signal from ${userId} to ${data.target}`);
              target.send(JSON.stringify({
                ...data,
                timestamp: Date.now()
              }));
            } else {
              console.log(`Target ${data.target} not found or connection closed`);
              // Notify sender that target is unavailable
              ws.send(JSON.stringify({
                type: 'error',
                error: 'Target user unavailable',
                target: data.target,
                timestamp: Date.now()
              }));
            }
          }
          break;
        }
        case 'textMessage': {
          broadcastToRoom(data.roomId, {
            type: 'textMessage',
            from: userId,
            message: data.message,
            timestamp: Date.now()
          });
          break;
        }
        case 'ping': {
          // Respond to client pings
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }));
          break;
        }
        default:
          console.log(`Unknown action: ${data.action}`);
      }
    } catch (error) {
      console.error(`Error processing message from ${userId}:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid message format',
        timestamp: Date.now()
      }));
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    console.log(`Connection closed: ${userId}`);

    // Clean up any rooms the user was in
    if (currentRoom) {
      roomManager.rooms.forEach((room, roomId) => {
        if (room.connections.has(userId)) {
          roomManager.leaveRoom(roomId, userId);
          broadcastToRoom(roomId, {
            type: 'userLeft',
            userId,
            timestamp: Date.now()
          });
        }
      });
    }
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for user ${userId}:`, error);
  });

  function broadcastToRoom(roomId, message, excludeUserId = null) {
    const room = roomManager.rooms.get(roomId);
    if (room) {
      let sentCount = 0;
      room.connections.forEach((connection, uid) => {
        if (uid !== excludeUserId && connection.readyState === WebSocket.OPEN) {
          connection.send(JSON.stringify(message));
          sentCount++;
        }
      });
      console.log(`Broadcast to room ${roomId}: ${sentCount} recipients`);
    }
  }
});

// Interval check for dead connections
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      console.log('Terminating inactive connection');
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Clean up interval on server shutdown
wss.on('close', () => {
  clearInterval(interval);
});

console.log('WebSocket server running on port 8080');

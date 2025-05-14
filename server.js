// === server.js ===
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const wss = new WebSocket.Server({ port: 8080 });

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(type = 'video') {
    const roomId = uuidv4();
    this.rooms.set(roomId, { connections: new Map(), type });
    return roomId;
  }

  joinRoom(roomId, userId, ws) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.connections.set(userId, ws);
      return room;
    }
    return null;
  }
}

const roomManager = new RoomManager();

wss.on('connection', (ws) => {
  const userId = uuidv4();
  let currentRoom = null;

  ws.send(JSON.stringify({ type: 'connection', userId }));

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    switch (data.action) {
      case 'createRoom': {
        const roomId = roomManager.createRoom(data.roomType);
        ws.send(JSON.stringify({ type: 'roomCreated', roomId }));
        break;
      }
      case 'joinRoom': {
        currentRoom = roomManager.joinRoom(data.roomId, userId, ws);
        if (currentRoom) {
          broadcastToRoom(data.roomId, {
            type: 'userJoined',
            userId,
            roomType: currentRoom.type,
          }, userId);
        }
        break;
      }
      case 'signal': {
        if (currentRoom) {
          const target = currentRoom.connections.get(data.target);
          if (target) target.send(JSON.stringify(data));
        }
        break;
      }
      case 'textMessage': {
        broadcastToRoom(data.roomId, {
          type: 'textMessage',
          from: userId,
          message: data.message,
        });
        break;
      }
    }
  });

  function broadcastToRoom(roomId, message, excludeUserId = null) {
    const room = roomManager.rooms.get(roomId);
    if (room) {
      room.connections.forEach((connection, uid) => {
        if (uid !== excludeUserId) {
          connection.send(JSON.stringify(message));
        }
      });
    }
  }
});

console.log('WebSocket server running on port 8080');

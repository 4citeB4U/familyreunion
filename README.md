# Family Reunion App

A web application for family reunions with features like RSVP, messaging, video chat, and more.

## Features

- RSVP system with name, number of attendees, and location
- Family message board with emoji support
- Private messaging between family members
- Video and voice chat capabilities
- Dark/light mode toggle
- Voice input for messages
- Animations (balloons, fireworks)
- Activity voting system
- Push-to-talk CB radio style communication

## Getting Started

### Prerequisites

- Node.js (for WebSocket server)
- Modern web browser

### Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

### Running the App

1. Start the WebSocket server:

   ```bash
   npm start
   ```

   This will start the server on port 8080.

2. Open `index.html` in your web browser.

## WebSocket Server

The app includes a WebSocket server for real-time communication. The server handles:

- Video and voice chat signaling
- Real-time messaging
- Room creation and management

If the WebSocket server is not running, the app will fall back to a simulated mode where video chat is simulated with placeholder videos.

## Usage

1. Fill out the RSVP form with your name, number of attendees, and location
2. Use the message board to post public messages
3. Select a family member to send private messages
4. Click on "Video & Voice Chat" to start a video chat
5. Choose between group chat or private chat with a specific family member
6. Use the push-to-talk feature for CB radio style communication

## Technologies Used

- HTML, CSS, JavaScript
- React (loaded via CDN)
- Tailwind CSS
- WebRTC for video/audio communication
- WebSockets for real-time signaling
- Local storage for data persistence

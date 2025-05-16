// Main React App Component
// This file contains the React components for the family reunion app

import {
  initializeAuth,
  initializeWebRTC,
  initializeVoiceInput,
  sendSMSNotification,
  loadAttendees,
  addAttendee,
  loadMessages,
  addMessage,
  loadActivities,
  addActivity,
  voteForActivity,
  setTheme,
  initializeTheme,
  createBalloon,
  createFireworks
} from './main.js';

// Main App Component
function App() {
  // State variables
  const [attendees, setAttendees] = React.useState([]);
  const [messages, setMessages] = React.useState([]);
  const [activities, setActivities] = React.useState([]);
  const [foods, setFoods] = React.useState([]);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [notification, setNotification] = React.useState(null);
  const [activeBalloons, setActiveBalloons] = React.useState([]);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [speechOutput, setSpeechOutput] = React.useState('');
  const [darkMode, setDarkMode] = React.useState(false);
  const [user, setUser] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState('public');
  const [publicMessage, setPublicMessage] = React.useState('');
  const [privateMessage, setPrivateMessage] = React.useState('');
  const [privateRecipient, setPrivateRecipient] = React.useState('');
  const [activitySuggestion, setActivitySuggestion] = React.useState('');
  const [foodSuggestion, setFoodSuggestion] = React.useState('');
  const [isCallInProgress, setIsCallInProgress] = React.useState(false);
  const [localStream, setLocalStream] = React.useState(null);
  const [remoteStreams, setRemoteStreams] = React.useState({});
  const [isVideoEnabled, setIsVideoEnabled] = React.useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = React.useState(true);
  const [localSpeaking, setLocalSpeaking] = React.useState(false);
  const [remoteSpeaking, setRemoteSpeaking] = React.useState(false);
  const [audioLevel, setAudioLevel] = React.useState(0);
  const [wsClient, setWsClient] = React.useState(null);
  const [recognition, setRecognition] = React.useState(null);
  
  // Refs
  const messagesEndRef = React.useRef(null);
  const publicMessageInputRef = React.useRef(null);
  const privateMessageInputRef = React.useRef(null);
  const activityInputRef = React.useRef(null);
  const foodInputRef = React.useRef(null);
  
  // Initialize app on component mount
  React.useEffect(() => {
    // Initialize theme
    initializeTheme();
    
    // Initialize auth
    initializeAuth().then(user => {
      setUser(user);
      
      // Check if user is admin
      if (user && user.displayName && user.displayName.toLowerCase().includes('admin')) {
        setIsAdmin(true);
      }
    });
    
    // Load data
    loadAttendees().then(setAttendees);
    loadMessages().then(setMessages);
    loadActivities().then(setActivities);
    
    // Initialize voice input
    const recognitionInstance = initializeVoiceInput(handleVoiceCommand);
    setRecognition(recognitionInstance);
    
    // Create balloons
    const balloonInterval = setInterval(() => {
      const balloon = createBalloon();
      setActiveBalloons(prev => [...prev, balloon]);
    }, 3000);
    
    // Clean up on component unmount
    return () => {
      clearInterval(balloonInterval);
      
      // Clean up active balloons
      activeBalloons.forEach(balloon => {
        if (document.body.contains(balloon)) {
          document.body.removeChild(balloon);
        }
      });
      
      // Stop local stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      // Disconnect WebRTC
      if (wsClient) {
        wsClient.disconnect();
      }
    };
  }, []);
  
  // Scroll to bottom of messages when messages change
  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Initialize WebRTC when call is started
  const initializeWebSocketClient = React.useCallback(() => {
    return initializeWebRTC(
      localStream,
      handleRemoteTrack,
      handleUserJoined,
      handleUserLeft,
      handleSpeakingDetection
    );
  }, [localStream, isCallInProgress]);
  
  // Handle remote track
  const handleRemoteTrack = (userId, stream) => {
    console.log(`Received track from ${userId}`);
    setRemoteStreams(prev => ({
      ...prev,
      [userId]: stream
    }));
  };
  
  // Handle user joined
  const handleUserJoined = (userId, type) => {
    console.log(`User ${userId} joined (${type})`);
    showNotification(`User ${userId} joined the call`, 'info');
  };
  
  // Handle user left
  const handleUserLeft = (userId) => {
    console.log(`User ${userId} left`);
    showNotification(`User ${userId} left the call`, 'info');
    
    // Remove remote stream
    setRemoteStreams(prev => {
      const newStreams = { ...prev };
      delete newStreams[userId];
      return newStreams;
    });
  };
  
  // Handle speaking detection
  const handleSpeakingDetection = (userId, isSpeaking, level) => {
    if (userId === 'local') {
      setLocalSpeaking(isSpeaking);
    } else {
      setRemoteSpeaking(isSpeaking);
    }
    
    setAudioLevel(level);
  };
  
  // Start video call
  const startVideoCall = async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      // Set local stream
      setLocalStream(stream);
      
      // Initialize WebRTC
      const client = initializeWebSocketClient();
      
      // Set call in progress
      setIsCallInProgress(true);
      
      showNotification('Video call started', 'success');
    } catch (error) {
      console.error('Error starting video call:', error);
      showNotification('Error starting video call. Please check your camera and microphone permissions.', 'error');
    }
  };
  
  // End video call
  const endVideoCall = () => {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    // Disconnect WebRTC
    if (wsClient) {
      wsClient.disconnect();
    }
    
    // Clear remote streams
    setRemoteStreams({});
    
    // Set call not in progress
    setIsCallInProgress(false);
    
    showNotification('Video call ended', 'info');
  };
  
  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };
  
  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };
  
  // Handle voice command
  const handleVoiceCommand = (command) => {
    console.log('Voice command:', command);
    setSpeechOutput(command);
    
    // Process voice command
    processVoiceCommand(
      command,
      activeTab === 'public' ? setPublicMessage : setPrivateMessage,
      activeTab === 'public' ? handlePublicMessageSubmit : handlePrivateMessageSubmit,
      () => activityInputRef.current && activityInputRef.current.focus()
    );
  };
  
  // Start voice recognition
  const startVoiceRecognition = () => {
    if (recognition) {
      startVoiceRecognition(
        recognition,
        setIsSpeaking,
        setSpeechOutput,
        showNotification,
        handleVoiceCommand,
        activeTab
      );
    } else {
      showNotification('Voice recognition is not available on this device or browser', 'error');
    }
  };
  
  // Show notification
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    
    // Auto-hide notification after 5 seconds
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };
  
  // Handle RSVP form submit
  const handleRSVPSubmit = async (event) => {
    event.preventDefault();
    
    try {
      // Get form data
      const form = event.target;
      const name = form.name.value;
      const email = form.email.value;
      const phone = form.phone.value;
      const location = form.location.value;
      const attendeeCount = parseInt(form.attendeeCount.value, 10);
      
      // Validate form data
      if (!name || !email || !location || isNaN(attendeeCount)) {
        showNotification('Please fill out all required fields', 'error');
        return;
      }
      
      // Add attendee
      await addAttendee({
        name,
        email,
        phone,
        location,
        attendeeCount,
        timestamp: new Date().toISOString()
      });
      
      // Show success notification
      showNotification('RSVP submitted successfully!', 'success');
      
      // Create fireworks animation
      const submitButton = form.querySelector('button[type="submit"]');
      const rect = submitButton.getBoundingClientRect();
      createFireworks(rect.left + rect.width / 2, rect.top);
      
      // Reset form
      form.reset();
      
      // Reload attendees
      loadAttendees().then(setAttendees);
    } catch (error) {
      console.error('Error submitting RSVP:', error);
      showNotification(`Error: ${error.message}`, 'error');
    }
  };
  
  // Handle public message submit
  const handlePublicMessageSubmit = async (event) => {
    if (event) event.preventDefault();
    
    try {
      // Validate message
      if (!publicMessage.trim()) {
        showNotification('Please enter a message', 'error');
        return;
      }
      
      // Add message
      await addMessage({
        sender: user ? user.displayName || user.uid : 'Anonymous',
        content: publicMessage,
        type: 'public',
        timestamp: new Date().toISOString()
      });
      
      // Show success notification
      showNotification('Message sent!', 'success');
      
      // Reset form
      setPublicMessage('');
      
      // Reload messages
      loadMessages().then(setMessages);
    } catch (error) {
      console.error('Error sending message:', error);
      showNotification(`Error: ${error.message}`, 'error');
    }
  };
  
  // Handle private message submit
  const handlePrivateMessageSubmit = async (event) => {
    if (event) event.preventDefault();
    
    try {
      // Validate message
      if (!privateMessage.trim()) {
        showNotification('Please enter a message', 'error');
        return;
      }
      
      // Validate recipient
      if (!privateRecipient) {
        showNotification('Please select a recipient', 'error');
        return;
      }
      
      // Add message
      await addMessage({
        sender: user ? user.displayName || user.uid : 'Anonymous',
        recipient: privateRecipient,
        content: privateMessage,
        type: 'private',
        timestamp: new Date().toISOString()
      });
      
      // Show success notification
      showNotification('Private message sent!', 'success');
      
      // Reset form
      setPrivateMessage('');
      
      // Reload messages
      loadMessages().then(setMessages);
    } catch (error) {
      console.error('Error sending private message:', error);
      showNotification(`Error: ${error.message}`, 'error');
    }
  };
  
  // Handle activity suggestion submit
  const handleActivitySubmit = async (event) => {
    event.preventDefault();
    
    try {
      // Validate suggestion
      if (!activitySuggestion.trim()) {
        showNotification('Please enter an activity suggestion', 'error');
        return;
      }
      
      // Add activity
      await addActivity({
        name: activitySuggestion,
        suggestedBy: user ? user.displayName || user.uid : 'Anonymous',
        timestamp: new Date().toISOString()
      });
      
      // Show success notification
      showNotification('Activity suggestion added!', 'success');
      
      // Reset form
      setActivitySuggestion('');
      
      // Reload activities
      loadActivities().then(setActivities);
    } catch (error) {
      console.error('Error adding activity suggestion:', error);
      showNotification(`Error: ${error.message}`, 'error');
    }
  };
  
  // Handle food suggestion submit
  const handleFoodSubmit = async (event) => {
    event.preventDefault();
    
    try {
      // Validate suggestion
      if (!foodSuggestion.trim()) {
        showNotification('Please enter a food suggestion', 'error');
        return;
      }
      
      // Add food
      await addActivity({
        name: foodSuggestion,
        type: 'food',
        suggestedBy: user ? user.displayName || user.uid : 'Anonymous',
        timestamp: new Date().toISOString()
      });
      
      // Show success notification
      showNotification('Food suggestion added!', 'success');
      
      // Reset form
      setFoodSuggestion('');
      
      // Reload activities
      loadActivities().then(setActivities);
    } catch (error) {
      console.error('Error adding food suggestion:', error);
      showNotification(`Error: ${error.message}`, 'error');
    }
  };
  
  // Handle activity vote
  const handleActivityVote = async (activityId) => {
    try {
      // Vote for activity
      await voteForActivity(activityId);
      
      // Show success notification
      showNotification('Vote recorded!', 'success');
      
      // Reload activities
      loadActivities().then(setActivities);
    } catch (error) {
      console.error('Error voting for activity:', error);
      showNotification(`Error: ${error.message}`, 'error');
    }
  };
  
  // Render the app
  return (
    <React.Fragment>
      {/* Notification */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
      
      {/* RSVP Card */}
      <div className="card">
        <div className="card-header">RSVP for the Reunion</div>
        <div className="card-body">
          <form onSubmit={handleRSVPSubmit}>
            <div className="form-group">
              <label htmlFor="name">Your Name</label>
              <input type="text" id="name" name="name" required />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input type="email" id="email" name="email" required />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone (for SMS updates)</label>
              <input type="tel" id="phone" name="phone" />
            </div>
            <div className="form-group">
              <label htmlFor="location">Your Location</label>
              <input type="text" id="location" name="location" required />
            </div>
            <div className="form-group">
              <label htmlFor="attendeeCount">Number of Attendees</label>
              <input type="number" id="attendeeCount" name="attendeeCount" min="1" defaultValue="1" required />
            </div>
            <button type="submit" id="submit-rsvp">Submit RSVP</button>
          </form>
        </div>
      </div>
      
      {/* Attendees List Card */}
      <div className="card">
        <div className="card-header">Who's Coming?</div>
        <div className="card-body">
          {attendees.length === 0 ? (
            <p>No RSVPs yet. Be the first to register!</p>
          ) : (
            <div className="attendees-list">
              <h3>Confirmed Attendees ({attendees.reduce((total, a) => total + a.attendeeCount, 0)})</h3>
              <ul>
                {attendees.map((attendee) => (
                  <li key={attendee.id}>
                    <strong>{attendee.name}</strong> from {attendee.location}
                    {attendee.attendeeCount > 1 && ` (+${attendee.attendeeCount - 1})`}
                  </li>
                ))}
              </ul>
              {isAdmin && (
                <button onClick={() => clearAttendees()}>Clear Attendees (Admin)</button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Message Board Card */}
      <div className="card">
        <div className="card-header">Family Message Board</div>
        <div className="card-body">
          <div className="message-tabs">
            <div 
              className={`message-tab ${activeTab === 'public' ? 'active' : ''}`}
              onClick={() => setActiveTab('public')}
            >
              Public Messages
            </div>
            <div 
              className={`message-tab ${activeTab === 'private' ? 'active' : ''}`}
              onClick={() => setActiveTab('private')}
            >
              Private Messages
            </div>
          </div>
          
          {activeTab === 'public' && (
            <React.Fragment>
              <div className="messages">
                {messages.filter(m => m.type === 'public').length === 0 ? (
                  <p>No messages yet. Start the conversation!</p>
                ) : (
                  messages
                    .filter(m => m.type === 'public')
                    .map((message) => (
                      <div key={message.id} className="message received">
                        <div className="message-header">
                          <span>{message.sender}</span>
                          <span className="message-time">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div>{message.content}</div>
                      </div>
                    ))
                )}
                <div ref={messagesEndRef} />
              </div>
              
              <form onSubmit={handlePublicMessageSubmit}>
                <div className="form-group">
                  <textarea
                    value={publicMessage}
                    onChange={(e) => setPublicMessage(e.target.value)}
                    placeholder="Type your message here..."
                    ref={publicMessageInputRef}
                  ></textarea>
                </div>
                <div className="message-options">
                  <button type="submit">Post Message</button>
                  <button type="button" onClick={startVoiceRecognition} className={isSpeaking ? 'active' : ''}>
                    <i className="fas fa-microphone"></i> Voice Input
                  </button>
                </div>
              </form>
            </React.Fragment>
          )}
          
          {activeTab === 'private' && (
            <React.Fragment>
              <div className="messages">
                {messages.filter(m => 
                  m.type === 'private' && 
                  (m.sender === (user?.displayName || user?.uid) || 
                   m.recipient === (user?.displayName || user?.uid))
                ).length === 0 ? (
                  <p>No private messages yet.</p>
                ) : (
                  messages
                    .filter(m => 
                      m.type === 'private' && 
                      (m.sender === (user?.displayName || user?.uid) || 
                       m.recipient === (user?.displayName || user?.uid))
                    )
                    .map((message) => (
                      <div 
                        key={message.id} 
                        className={`message private ${message.sender === (user?.displayName || user?.uid) ? 'sent' : 'received'}`}
                      >
                        <div className="message-header">
                          <span>
                            {message.sender === (user?.displayName || user?.uid) 
                              ? `To: ${message.recipient}` 
                              : `From: ${message.sender}`}
                            <span className="message-type-badge">Private</span>
                          </span>
                          <span className="message-time">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div>{message.content}</div>
                      </div>
                    ))
                )}
                <div ref={messagesEndRef} />
              </div>
              
              <form onSubmit={handlePrivateMessageSubmit}>
                <div className="form-group">
                  <label htmlFor="privateRecipient">Send To:</label>
                  <select 
                    id="privateRecipient"
                    value={privateRecipient}
                    onChange={(e) => setPrivateRecipient(e.target.value)}
                    required
                  >
                    <option value="">Select Recipient</option>
                    {attendees.map((attendee) => (
                      <option key={attendee.id} value={attendee.name}>
                        {attendee.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <textarea
                    value={privateMessage}
                    onChange={(e) => setPrivateMessage(e.target.value)}
                    placeholder="Type your private message here..."
                    ref={privateMessageInputRef}
                  ></textarea>
                </div>
                <div className="message-options">
                  <button type="submit">Send Private Message</button>
                  <button type="button" onClick={startVoiceRecognition} className={isSpeaking ? 'active' : ''}>
                    <i className="fas fa-microphone"></i> Voice Input
                  </button>
                </div>
              </form>
            </React.Fragment>
          )}
        </div>
      </div>
      
      {/* Activities Card */}
      <div className="card">
        <div className="card-header">Activities & Food</div>
        <div className="card-body">
          <h3>Suggested Activities</h3>
          <ul className="activities-list">
            {activities.filter(a => !a.type || a.type === 'activity').map((activity) => (
              <li key={activity.id}>
                <div className="activity-item">
                  <span>{activity.name}</span>
                  <button onClick={() => handleActivityVote(activity.id)}>
                    Vote ({activity.votes || 0})
                  </button>
                </div>
              </li>
            ))}
          </ul>
          
          <form onSubmit={handleActivitySubmit}>
            <div className="form-group">
              <input
                type="text"
                value={activitySuggestion}
                onChange={(e) => setActivitySuggestion(e.target.value)}
                placeholder="Suggest an activity..."
                ref={activityInputRef}
              />
            </div>
            <button type="submit">Add Activity</button>
          </form>
          
          <h3>Food Suggestions</h3>
          <ul className="activities-list">
            {activities.filter(a => a.type === 'food').map((food) => (
              <li key={food.id}>
                <div className="activity-item">
                  <span>{food.name}</span>
                  <button onClick={() => handleActivityVote(food.id)}>
                    Vote ({food.votes || 0})
                  </button>
                </div>
              </li>
            ))}
          </ul>
          
          <form onSubmit={handleFoodSubmit}>
            <div className="form-group">
              <input
                type="text"
                value={foodSuggestion}
                onChange={(e) => setFoodSuggestion(e.target.value)}
                placeholder="Suggest a food item..."
                ref={foodInputRef}
              />
            </div>
            <button type="submit">Add Food</button>
          </form>
        </div>
      </div>
      
      {/* Video Chat Card */}
      <div className="card">
        <div className="card-header">Family Video Chat</div>
        <div className="card-body">
          {!isCallInProgress ? (
            <div className="call-start">
              <p>Start a video call with your family members</p>
              <button onClick={startVideoCall}>
                <i className="fas fa-video"></i> Start Video Call
              </button>
            </div>
          ) : (
            <React.Fragment>
              <div className="video-container">
                {/* Local video */}
                <div className="video-item self">
                  {localStream && (
                    <video
                      autoPlay
                      muted
                      playsInline
                      ref={(video) => {
                        if (video && localStream) video.srcObject = localStream;
                      }}
                    ></video>
                  )}
                  <div className="video-name">
                    You {localSpeaking && <span className="pulse"></span>}
                  </div>
                </div>
                
                {/* Remote videos */}
                {Object.entries(remoteStreams).map(([userId, stream]) => (
                  <div className="video-item" key={userId}>
                    <video
                      autoPlay
                      playsInline
                      ref={(video) => {
                        if (video && stream) video.srcObject = stream;
                      }}
                    ></video>
                    <div className="video-name">
                      {userId} {remoteSpeaking && <span className="pulse"></span>}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="video-controls">
                <button 
                  className={`video-control-button ${isVideoEnabled ? '' : 'active'}`}
                  onClick={toggleVideo}
                >
                  <i className={`fas ${isVideoEnabled ? 'fa-video' : 'fa-video-slash'}`}></i>
                </button>
                <button 
                  className={`video-control-button ${isAudioEnabled ? '' : 'active'}`}
                  onClick={toggleAudio}
                >
                  <i className={`fas ${isAudioEnabled ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
                </button>
                <button 
                  className="video-control-button active"
                  onClick={endVideoCall}
                >
                  <i className="fas fa-phone-slash"></i>
                </button>
              </div>
            </React.Fragment>
          )}
        </div>
      </div>
      
      {/* Speech Output Display */}
      {speechOutput && (
        <div className="fixed bottom-5 left-5 z-50 bg-white p-3 rounded-lg shadow-lg max-w-xs">
          <div className="text-sm font-medium">Voice Input:</div>
          <div className="text-gray-700">{speechOutput}</div>
        </div>
      )}
    </React.Fragment>
  );
}

// Render the app
ReactDOM.render(<App />, document.getElementById('app'));

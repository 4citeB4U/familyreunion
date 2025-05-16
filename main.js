// Main Application Script
// This file contains the main application logic for the family reunion app

import {
  // Firebase
  app,
  db,
  auth,
  rtdb,
  attendeesRef,
  messagesRef,
  activitiesRef,
  foodsRef,
  usersRef,
  firestoreHelpers,
  rtdbHelpers,
  authHelpers,
  serverTimestamp,
  
  // WebRTC
  LEEWAYWebRTCClient,
  
  // SMS
  sendSMS,
  
  // Voice Input
  setupSpeechRecognition,
  processVoiceCommand,
  startVoiceRecognition
} from './services.js';

// Initialize Firebase Auth
const initializeAuth = async () => {
  try {
    // Sign in anonymously
    const user = await authHelpers.signInAnonymously();
    console.log('Signed in anonymously:', user.uid);
    
    // Set up auth state change listener
    authHelpers.onAuthStateChanged((user) => {
      if (user) {
        console.log('User is signed in:', user.uid);
        // Update user status in database
        rtdbHelpers.setData(`presence/${user.uid}`, {
          online: true,
          lastSeen: new Date().toISOString()
        });
      } else {
        console.log('User is signed out');
      }
    });
    
    return user;
  } catch (error) {
    console.error('Error initializing auth:', error);
    return null;
  }
};

// Initialize WebRTC
const initializeWebRTC = (localStream, onTrack, onUserJoined, onUserLeft, onSpeaking) => {
  try {
    // Create WebRTC client
    const client = new LEEWAYWebRTCClient();
    
    // Set local stream if available
    if (localStream) {
      client.setLocalStream(localStream);
    }
    
    // Set up callbacks
    client.onTrack((userId, stream) => {
      console.log(`Received track from ${userId}`);
      if (onTrack) onTrack(userId, stream);
    });
    
    client.onUserJoined((userId, type) => {
      console.log(`User ${userId} joined (${type})`);
      if (onUserJoined) onUserJoined(userId, type);
    });
    
    client.onUserLeft((userId) => {
      console.log(`User ${userId} left`);
      if (onUserLeft) onUserLeft(userId);
    });
    
    client.onSpeaking((userId, isSpeaking, level) => {
      if (onSpeaking) onSpeaking(userId, isSpeaking, level);
    });
    
    // Connect to signaling server
    client.connect()
      .then(() => {
        console.log('Connected to signaling server');
      })
      .catch((error) => {
        console.error('Error connecting to signaling server:', error);
      });
    
    return client;
  } catch (error) {
    console.error('Error initializing WebRTC:', error);
    return null;
  }
};

// Initialize Voice Input
const initializeVoiceInput = (onResult) => {
  try {
    // Set up speech recognition
    const recognition = setupSpeechRecognition(onResult);
    
    return recognition;
  } catch (error) {
    console.error('Error initializing voice input:', error);
    return null;
  }
};

// Send SMS Notification
const sendSMSNotification = async (phoneNumber, message) => {
  try {
    // Send SMS
    const result = await sendSMS(phoneNumber, message);
    console.log('SMS sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return null;
  }
};

// Load Attendees
const loadAttendees = async () => {
  try {
    // Get attendees from Firestore
    const attendees = await firestoreHelpers.getDocuments(attendeesRef);
    console.log('Loaded attendees:', attendees);
    return attendees;
  } catch (error) {
    console.error('Error loading attendees:', error);
    return [];
  }
};

// Add Attendee
const addAttendee = async (attendee) => {
  try {
    // Check for duplicate
    const existingAttendees = await firestoreHelpers.queryDocuments(
      attendeesRef,
      'name',
      '==',
      attendee.name
    );
    
    const duplicateExists = existingAttendees.some(existing => 
      existing.location.toLowerCase() === attendee.location.toLowerCase()
    );
    
    if (duplicateExists) {
      throw new Error('A person with this name and location has already RSVP\'d');
    }
    
    // Add attendee to Firestore
    const result = await firestoreHelpers.addDocument(attendeesRef, {
      ...attendee,
      timestamp: serverTimestamp()
    });
    
    console.log('Added attendee:', result);
    
    // Send SMS notification if phone number is provided
    if (attendee.phone) {
      await sendSMSNotification(
        attendee.phone,
        `Thank you for registering for the Hall Family Reunion! We look forward to seeing you there.`
      );
    }
    
    return result;
  } catch (error) {
    console.error('Error adding attendee:', error);
    throw error;
  }
};

// Load Messages
const loadMessages = async () => {
  try {
    // Get messages from Firestore
    const messages = await firestoreHelpers.getDocuments(messagesRef);
    console.log('Loaded messages:', messages);
    return messages;
  } catch (error) {
    console.error('Error loading messages:', error);
    return [];
  }
};

// Add Message
const addMessage = async (message) => {
  try {
    // Add message to Firestore
    const result = await firestoreHelpers.addDocument(messagesRef, {
      ...message,
      timestamp: serverTimestamp()
    });
    
    console.log('Added message:', result);
    return result;
  } catch (error) {
    console.error('Error adding message:', error);
    throw error;
  }
};

// Load Activities
const loadActivities = async () => {
  try {
    // Get activities from Firestore
    const activities = await firestoreHelpers.getDocuments(activitiesRef);
    console.log('Loaded activities:', activities);
    return activities;
  } catch (error) {
    console.error('Error loading activities:', error);
    return [];
  }
};

// Add Activity
const addActivity = async (activity) => {
  try {
    // Add activity to Firestore
    const result = await firestoreHelpers.addDocument(activitiesRef, {
      ...activity,
      votes: 0,
      timestamp: serverTimestamp()
    });
    
    console.log('Added activity:', result);
    return result;
  } catch (error) {
    console.error('Error adding activity:', error);
    throw error;
  }
};

// Vote for Activity
const voteForActivity = async (activityId) => {
  try {
    // Get activity
    const activity = await firestoreHelpers.getDocument(activitiesRef, activityId);
    
    if (!activity) {
      throw new Error('Activity not found');
    }
    
    // Update activity votes
    const result = await firestoreHelpers.updateDocument(
      activitiesRef,
      activityId,
      { votes: (activity.votes || 0) + 1 }
    );
    
    console.log('Voted for activity:', result);
    return result;
  } catch (error) {
    console.error('Error voting for activity:', error);
    throw error;
  }
};

// Set Theme
const setTheme = (isDark) => {
  if (isDark) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  
  // Save theme preference
  localStorage.setItem('hall-reunion-theme', isDark ? 'dark' : 'light');
};

// Initialize Theme
const initializeTheme = () => {
  // Check for saved theme preference
  const savedTheme = localStorage.getItem('hall-reunion-theme');
  
  if (savedTheme) {
    // Use saved preference
    setTheme(savedTheme === 'dark');
  } else {
    // Check system preference
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDarkScheme);
  }
};

// Create Balloon Animation
const createBalloon = () => {
  const colors = ['yellow', 'white', 'red']; // Per requirements
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  
  const balloon = document.createElement('div');
  balloon.className = `balloon ${randomColor}`;
  
  // Set random position along the perimeter (never on top of cards)
  const position = Math.random();
  let top, left;
  
  if (position < 0.25) {
    // Top edge
    top = 0;
    left = Math.random() * 100;
  } else if (position < 0.5) {
    // Right edge
    top = Math.random() * 100;
    left = 100;
  } else if (position < 0.75) {
    // Bottom edge
    top = 100;
    left = Math.random() * 100;
  } else {
    // Left edge
    top = Math.random() * 100;
    left = 0;
  }
  
  balloon.style.top = `${top}vh`;
  balloon.style.left = `${left}vw`;
  
  // Random size
  const size = 30 + Math.random() * 20;
  balloon.style.width = `${size}px`;
  balloon.style.height = `${size * 1.2}px`;
  
  // Random animation duration
  const duration = 10 + Math.random() * 20;
  balloon.style.animationDuration = `${duration}s`;
  
  document.body.appendChild(balloon);
  
  // Remove balloon after animation
  setTimeout(() => {
    if (document.body.contains(balloon)) {
      document.body.removeChild(balloon);
    }
  }, duration * 1000);
  
  return balloon;
};

// Create Fireworks Animation
const createFireworks = (x, y) => {
  const fireworks = document.createElement('div');
  fireworks.className = 'fireworks';
  fireworks.style.left = `${x}px`;
  fireworks.style.top = `${y}px`;
  
  document.body.appendChild(fireworks);
  
  // Remove fireworks after animation
  setTimeout(() => {
    if (document.body.contains(fireworks)) {
      document.body.removeChild(fireworks);
    }
  }, 1000);
  
  return fireworks;
};

// Export all functions
export {
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
};

// Services Module
// This file exports all services for the family reunion application

// Import Firebase configuration and helpers
import {
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
  serverTimestamp
} from './firebase-config.js';

// Import WebRTC service
import { LEEWAYWebRTCClient } from './webrtc-service.js';
import './webrtc-service-part2.js';
import './webrtc-service-part3.js';

// Import SMS service
import { sendSMS } from './sms-service.js';

// Import Voice Input service
import {
  setupSpeechRecognition,
  processVoiceCommand,
  startVoiceRecognition
} from './voice-input-service.js';

// Export all services
export {
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
};

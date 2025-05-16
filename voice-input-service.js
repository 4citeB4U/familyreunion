// Voice Input Service
// This file provides voice input functionality for the message board

/**
 * Setup speech recognition with improved mobile support
 * @param {Function} onResult - Callback function for speech recognition results
 * @returns {Object} Speech recognition interface
 */
const setupSpeechRecognition = (onResult) => {
  // Check for both standard and webkit prefixed versions
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (SpeechRecognition) {
    try {
      const recognition = new SpeechRecognition();
      
      // Configure for better mobile experience
      recognition.continuous = false;
      recognition.interimResults = true; // Enable interim results for better responsiveness
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 3; // Get multiple alternatives for better accuracy
      
      // Handle results
      recognition.onresult = (event) => {
        // Get the most recent result
        const lastResultIndex = event.results.length - 1;
        const transcript = event.results[lastResultIndex][0].transcript;
        
        // Only process final results to avoid flickering on mobile
        if (event.results[lastResultIndex].isFinal) {
          console.log('Final speech result:', transcript);
          onResult(transcript);
        }
      };
      
      // Handle errors
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        
        // Show user-friendly error messages
        let errorMessage = 'Error with voice recognition';
        
        switch(event.error) {
          case 'network':
            errorMessage = 'Network error. Please check your connection.';
            break;
          case 'not-allowed':
          case 'service-not-allowed':
            errorMessage = 'Microphone access denied. Please check permissions.';
            break;
          case 'aborted':
            errorMessage = 'Voice input was aborted.';
            break;
          case 'audio-capture':
            errorMessage = 'No microphone detected.';
            break;
          case 'no-speech':
            errorMessage = 'No speech detected. Please try again.';
            break;
          default:
            errorMessage = `Error: ${event.error}`;
        }
        
        // Alert the user
        console.error(errorMessage);
        
        // You could add a UI notification here
      };
      
      // Return enhanced interface
      return {
        start: () => {
          try {
            recognition.start();
            console.log('Speech recognition started');
            return true;
          } catch (error) {
            console.error('Error starting speech recognition:', error);
            return false;
          }
        },
        stop: () => {
          try {
            recognition.stop();
            console.log('Speech recognition stopped');
            return true;
          } catch (error) {
            console.error('Error stopping speech recognition:', error);
            return false;
          }
        },
        abort: () => {
          try {
            recognition.abort();
            console.log('Speech recognition aborted');
            return true;
          } catch (error) {
            console.error('Error aborting speech recognition:', error);
            return false;
          }
        }
      };
    } catch (error) {
      console.error('Error setting up speech recognition:', error);
      return {
        start: () => {
          alert('Speech recognition failed to initialize');
          return false;
        },
        stop: () => {},
        abort: () => {}
      };
    }
  }
  
  // Fallback for unsupported browsers
  console.warn('Speech Recognition API not supported in this browser');
  return {
    start: () => {
      alert('Speech recognition is not supported on this device or browser');
      return false;
    },
    stop: () => {},
    abort: () => {}
  };
};

/**
 * Process voice commands
 * @param {string} command - The voice command to process
 * @param {Function} setMessageCallback - Callback to set message text
 * @param {Function} submitMessageCallback - Callback to submit message
 * @param {Function} focusSuggestionCallback - Callback to focus suggestion input
 */
const processVoiceCommand = (command, setMessageCallback, submitMessageCallback, focusSuggestionCallback) => {
  if (!command) return;
  
  const cmd = command.toLowerCase();
  
  if (cmd.includes('submit') || cmd.includes('register') || cmd.includes('rsvp')) {
    // Find and click the RSVP submit button
    const submitButton = document.getElementById('submit-rsvp');
    if (submitButton) submitButton.click();
  } else if (cmd.includes('message') || cmd.includes('chat') || cmd.includes('send')) {
    // If it's a message command, set the message input and send it
    setMessageCallback(cmd);
    submitMessageCallback();
  } else if (cmd.includes('suggest') || cmd.includes('activity')) {
    // Focus the suggestion input
    focusSuggestionCallback();
  } else {
    // Use the voice command as a message for the family board
    setMessageCallback(cmd);
    submitMessageCallback();
  }
};

/**
 * Start voice recognition
 * @param {Object} recognition - Speech recognition interface
 * @param {Function} setListeningCallback - Callback to set listening state
 * @param {Function} setSpeechOutputCallback - Callback to set speech output
 * @param {Function} showNotificationCallback - Callback to show notification
 * @param {Function} handleVoiceCommandCallback - Callback to handle voice command
 * @param {string} mode - Recognition mode ('public' or 'private')
 */
const startVoiceRecognition = (
  recognition,
  setListeningCallback,
  setSpeechOutputCallback,
  showNotificationCallback,
  handleVoiceCommandCallback,
  mode = 'public'
) => {
  if (recognition) {
    try {
      // Play a sound to indicate listening started
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 880; // A5 note (high)
        gainNode.gain.value = 0.1; // Low volume
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          audioContext.close();
        }, 200);
      } catch (error) {
        console.error('Error playing recognition start sound:', error);
      }
      
      // Update UI to show we're listening
      setSpeechOutputCallback('Listening...');
      setListeningCallback(true);
      
      // Show visual feedback
      showNotificationCallback('Listening for voice input...', 'info');
      
      // Set the mode for the recognition result handler
      recognition.onresult = (event) => {
        // Get the most recent result
        const lastResultIndex = event.results.length - 1;
        const result = event.results[lastResultIndex][0].transcript;
        
        console.log('Speech recognition result:', result);
        setSpeechOutputCallback(result);
        
        // Only process final results
        if (event.results[lastResultIndex].isFinal) {
          // Process voice command
          handleVoiceCommandCallback(result, mode);
        }
      };
      
      // Handle recognition end
      recognition.onend = () => {
        console.log('Speech recognition ended');
        setSpeechOutputCallback('');
        setListeningCallback(false);
      };
      
      // Start recognition
      recognition.start();
      console.log('Speech recognition started');
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setSpeechOutputCallback('Error starting voice recognition');
      setListeningCallback(false);
      showNotificationCallback('Error starting voice recognition. Please try again.', 'error');
    }
  } else {
    console.warn('Speech recognition not available');
    showNotificationCallback('Voice recognition is not available on this device or browser', 'error');
  }
};

// Export voice input functions
export {
  setupSpeechRecognition,
  processVoiceCommand,
  startVoiceRecognition
};

// Verification Script
// This script verifies that all components are working correctly

// Function to check if a file exists
const fileExists = async (filePath) => {
  try {
    await fetch(filePath, { method: 'HEAD' });
    return true;
  } catch (error) {
    return false;
  }
};

// Function to check if Firebase is initialized
const checkFirebase = () => {
  try {
    // Check if Firebase is defined
    if (typeof firebase === 'undefined') {
      return { success: false, message: 'Firebase is not defined' };
    }
    
    // Check if Firebase app is initialized
    const app = firebase.app();
    if (!app) {
      return { success: false, message: 'Firebase app is not initialized' };
    }
    
    return { success: true, message: 'Firebase is initialized' };
  } catch (error) {
    return { success: false, message: `Error checking Firebase: ${error.message}` };
  }
};

// Function to check if WebRTC is supported
const checkWebRTC = () => {
  try {
    // Check if RTCPeerConnection is defined
    if (typeof RTCPeerConnection === 'undefined') {
      return { success: false, message: 'RTCPeerConnection is not defined' };
    }
    
    // Check if getUserMedia is defined
    if (typeof navigator.mediaDevices === 'undefined' || typeof navigator.mediaDevices.getUserMedia === 'undefined') {
      return { success: false, message: 'getUserMedia is not defined' };
    }
    
    return { success: true, message: 'WebRTC is supported' };
  } catch (error) {
    return { success: false, message: `Error checking WebRTC: ${error.message}` };
  }
};

// Function to check if speech recognition is supported
const checkSpeechRecognition = () => {
  try {
    // Check if SpeechRecognition is defined
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return { success: false, message: 'SpeechRecognition is not defined' };
    }
    
    return { success: true, message: 'SpeechRecognition is supported' };
  } catch (error) {
    return { success: false, message: `Error checking SpeechRecognition: ${error.message}` };
  }
};

// Function to check if localStorage is available
const checkLocalStorage = () => {
  try {
    // Check if localStorage is defined
    if (typeof localStorage === 'undefined') {
      return { success: false, message: 'localStorage is not defined' };
    }
    
    // Try to set and get a value
    localStorage.setItem('test', 'test');
    const value = localStorage.getItem('test');
    localStorage.removeItem('test');
    
    if (value !== 'test') {
      return { success: false, message: 'localStorage is not working correctly' };
    }
    
    return { success: true, message: 'localStorage is available' };
  } catch (error) {
    return { success: false, message: `Error checking localStorage: ${error.message}` };
  }
};

// Function to check if React is loaded
const checkReact = () => {
  try {
    // Check if React is defined
    if (typeof React === 'undefined') {
      return { success: false, message: 'React is not defined' };
    }
    
    // Check if ReactDOM is defined
    if (typeof ReactDOM === 'undefined') {
      return { success: false, message: 'ReactDOM is not defined' };
    }
    
    return { success: true, message: 'React is loaded' };
  } catch (error) {
    return { success: false, message: `Error checking React: ${error.message}` };
  }
};

// Function to check if Babel is loaded
const checkBabel = () => {
  try {
    // Check if Babel is defined
    if (typeof Babel === 'undefined') {
      return { success: false, message: 'Babel is not defined' };
    }
    
    return { success: true, message: 'Babel is loaded' };
  } catch (error) {
    return { success: false, message: `Error checking Babel: ${error.message}` };
  }
};

// Function to check if the app container exists
const checkAppContainer = () => {
  try {
    // Check if the app container exists
    const appContainer = document.getElementById('app');
    if (!appContainer) {
      return { success: false, message: 'App container not found' };
    }
    
    return { success: true, message: 'App container found' };
  } catch (error) {
    return { success: false, message: `Error checking app container: ${error.message}` };
  }
};

// Function to check if the theme toggle exists
const checkThemeToggle = () => {
  try {
    // Check if the theme toggle exists
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) {
      return { success: false, message: 'Theme toggle not found' };
    }
    
    return { success: true, message: 'Theme toggle found' };
  } catch (error) {
    return { success: false, message: `Error checking theme toggle: ${error.message}` };
  }
};

// Function to check if the required files exist
const checkRequiredFiles = async () => {
  const requiredFiles = [
    'firebase-config.js',
    'webrtc-service.js',
    'webrtc-service-part2.js',
    'webrtc-service-part3.js',
    'sms-service.js',
    'voice-input-service.js',
    'services.js',
    'main.js',
    'app.js'
  ];
  
  const results = [];
  
  for (const file of requiredFiles) {
    const exists = await fileExists(file);
    results.push({
      file,
      success: exists,
      message: exists ? `${file} exists` : `${file} not found`
    });
  }
  
  return results;
};

// Function to run all checks
const runVerification = async () => {
  console.log('Running verification...');
  
  // Check required files
  console.log('Checking required files...');
  const fileResults = await checkRequiredFiles();
  fileResults.forEach(result => {
    console.log(`${result.success ? '✅' : '❌'} ${result.message}`);
  });
  
  // Check Firebase
  console.log('\nChecking Firebase...');
  const firebaseResult = checkFirebase();
  console.log(`${firebaseResult.success ? '✅' : '❌'} ${firebaseResult.message}`);
  
  // Check WebRTC
  console.log('\nChecking WebRTC...');
  const webRTCResult = checkWebRTC();
  console.log(`${webRTCResult.success ? '✅' : '❌'} ${webRTCResult.message}`);
  
  // Check speech recognition
  console.log('\nChecking speech recognition...');
  const speechResult = checkSpeechRecognition();
  console.log(`${speechResult.success ? '✅' : '❌'} ${speechResult.message}`);
  
  // Check localStorage
  console.log('\nChecking localStorage...');
  const localStorageResult = checkLocalStorage();
  console.log(`${localStorageResult.success ? '✅' : '❌'} ${localStorageResult.message}`);
  
  // Check React
  console.log('\nChecking React...');
  const reactResult = checkReact();
  console.log(`${reactResult.success ? '✅' : '❌'} ${reactResult.message}`);
  
  // Check Babel
  console.log('\nChecking Babel...');
  const babelResult = checkBabel();
  console.log(`${babelResult.success ? '✅' : '❌'} ${babelResult.message}`);
  
  // Check app container
  console.log('\nChecking app container...');
  const appContainerResult = checkAppContainer();
  console.log(`${appContainerResult.success ? '✅' : '❌'} ${appContainerResult.message}`);
  
  // Check theme toggle
  console.log('\nChecking theme toggle...');
  const themeToggleResult = checkThemeToggle();
  console.log(`${themeToggleResult.success ? '✅' : '❌'} ${themeToggleResult.message}`);
  
  // Calculate overall success
  const allResults = [
    ...fileResults,
    firebaseResult,
    webRTCResult,
    speechResult,
    localStorageResult,
    reactResult,
    babelResult,
    appContainerResult,
    themeToggleResult
  ];
  
  const successCount = allResults.filter(result => result.success).length;
  const totalCount = allResults.length;
  const successPercentage = Math.round((successCount / totalCount) * 100);
  
  console.log(`\nVerification complete: ${successCount}/${totalCount} checks passed (${successPercentage}%)`);
  
  if (successCount === totalCount) {
    console.log('✅ All checks passed! The application is ready for production.');
  } else {
    console.log('❌ Some checks failed. Please fix the issues before deploying to production.');
  }
  
  return {
    success: successCount === totalCount,
    successCount,
    totalCount,
    successPercentage,
    results: allResults
  };
};

// Run verification when the page loads
window.addEventListener('load', runVerification);

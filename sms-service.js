// SMS Service using Twilio
// This file provides SMS notification functionality

// In a production environment, this would be a server-side implementation
// For client-side demo purposes, we'll simulate the SMS sending

/**
 * Send an SMS notification
 * @param {string} phoneNumber - The recipient's phone number
 * @param {string} message - The message to send
 * @returns {Promise<object>} - A promise that resolves to the result of the SMS operation
 */
const sendSMS = async (phoneNumber, message) => {
  // In production, this would make an API call to a secure backend
  // that handles the Twilio credentials and API calls
  
  // For demo purposes, we'll simulate the SMS sending
  console.log('SIMULATED SMS to', phoneNumber, ':', message);
  
  // Create a visual notification to show what would happen
  const adminPhone = phoneNumber || '+1 (414) 367-6211'; // Format for display only
  const twilioPhone = '+1 (844) 710-0481'; // Format for display only
  
  // Remove any existing SMS notifications to prevent stacking
  const existingNotifications = document.querySelectorAll('.sms-simulation');
  existingNotifications.forEach(notification => {
    notification.remove();
  });
  
  // Create a more detailed SMS simulation popup with enhanced visibility
  const smsElement = document.createElement('div');
  smsElement.className = 'sms-simulation';
  smsElement.innerHTML = `
    <div class="sms-header">
      <i class="fas fa-sms mr-2"></i> SMS Notification
      <button class="sms-close">&times;</button>
    </div>
    <div class="sms-body">
      <div class="sms-info">
        <div><strong>From:</strong> ${twilioPhone}</div>
        <div><strong>To:</strong> ${adminPhone}</div>
        <div><strong>Time:</strong> ${new Date().toLocaleTimeString()}</div>
      </div>
      <div class="sms-message">
        <div class="sms-bubble">
          ${message}
        </div>
      </div>
      <div class="sms-note">
        <i class="fas fa-info-circle mr-1"></i> This is a simulation. In production, this would be sent via Twilio API.
      </div>
    </div>
  `;
  
  // Add styles to the SMS simulation
  smsElement.style.position = 'fixed';
  smsElement.style.bottom = '20px';
  smsElement.style.right = '20px';
  smsElement.style.width = '300px';
  smsElement.style.backgroundColor = 'white';
  smsElement.style.borderRadius = '8px';
  smsElement.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  smsElement.style.zIndex = '1000';
  smsElement.style.overflow = 'hidden';
  smsElement.style.animation = 'sms-slide-in 0.3s ease-out forwards';
  
  // Add styles for the header
  const header = smsElement.querySelector('.sms-header');
  header.style.backgroundColor = '#1DA1F2';
  header.style.color = 'white';
  header.style.padding = '10px 15px';
  header.style.fontWeight = 'bold';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  
  // Add styles for the body
  const body = smsElement.querySelector('.sms-body');
  body.style.padding = '15px';
  
  // Add styles for the info section
  const info = smsElement.querySelector('.sms-info');
  info.style.marginBottom = '10px';
  info.style.fontSize = '0.9rem';
  info.style.color = '#666';
  
  // Add styles for the message
  const message = smsElement.querySelector('.sms-message');
  message.style.marginBottom = '10px';
  
  // Add styles for the bubble
  const bubble = smsElement.querySelector('.sms-bubble');
  bubble.style.backgroundColor = '#E5F7FF';
  bubble.style.padding = '10px 15px';
  bubble.style.borderRadius = '18px';
  bubble.style.display = 'inline-block';
  bubble.style.maxWidth = '100%';
  bubble.style.wordBreak = 'break-word';
  
  // Add styles for the note
  const note = smsElement.querySelector('.sms-note');
  note.style.fontSize = '0.8rem';
  note.style.color = '#888';
  note.style.fontStyle = 'italic';
  
  // Add styles for the close button
  const closeButton = smsElement.querySelector('.sms-close');
  closeButton.style.background = 'none';
  closeButton.style.border = 'none';
  closeButton.style.color = 'white';
  closeButton.style.fontSize = '1.2rem';
  closeButton.style.cursor = 'pointer';
  
  // Add the element to the body
  document.body.appendChild(smsElement);
  
  // Add keyframes for the animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes sms-slide-in {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes sms-slide-out {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  
  // Add close button functionality
  closeButton.addEventListener('click', () => {
    smsElement.style.animation = 'sms-slide-out 0.3s ease-in forwards';
    setTimeout(() => {
      smsElement.remove();
    }, 300);
  });
  
  // Auto-remove after 8 seconds
  setTimeout(() => {
    if (document.body.contains(smsElement)) {
      smsElement.style.animation = 'sms-slide-out 0.3s ease-in forwards';
      setTimeout(() => {
        smsElement.remove();
      }, 300);
    }
  }, 8000);
  
  // Return a simulated success response
  return {
    success: true,
    sid: 'SM' + Math.random().toString(36).substr(2, 9),
    dateCreated: new Date().toISOString()
  };
};

// Export the SMS service
export { sendSMS };

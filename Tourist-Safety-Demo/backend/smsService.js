// smsService.js - Twilio SMS service utilities
const twilio = require('twilio');

// Initialize Twilio client
let twilioClient = null;
let smsEnabled = false;

// Initialize SMS service
function initializeSMS() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const smsEnabledEnv = process.env.SMS_ENABLED;

  if (!accountSid || !authToken) {
    console.warn('⚠️  Twilio credentials not found. SMS functionality disabled.');
    console.warn('   Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in your .env file');
    return false;
  }

  if (smsEnabledEnv === 'false' || smsEnabledEnv === false) {
    console.log('📱 SMS functionality disabled via SMS_ENABLED environment variable');
    return false;
  }

  try {
    twilioClient = twilio(accountSid, authToken);
    smsEnabled = true;
    console.log('✅ Twilio SMS service initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Twilio SMS service:', error.message);
    return false;
  }
}

/**
 * Send SMS message using Twilio
 * @param {string} to - Recipient phone number (E.164 format)
 * @param {string} message - SMS message content
 * @param {string} fromName - Sender name for display
 * @returns {Promise<Object>} - SMS delivery result
 */
async function sendSMS(to, message, fromName = 'Tourist Safety System') {
  if (!smsEnabled || !twilioClient) {
    console.log('📱 SMS disabled - simulating SMS send');
    return {
      success: false,
      error: 'SMS service not available',
      simulated: true
    };
  }

  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!fromNumber) {
    console.error('❌ TWILIO_PHONE_NUMBER not configured');
    return {
      success: false,
      error: 'Twilio phone number not configured'
    };
  }

  try {
    // Format phone number to E.164 if needed
    const formattedTo = formatPhoneNumber(to);
    if (!formattedTo) {
      throw new Error('Invalid phone number format');
    }

    console.log(`📱 Sending SMS to ${formattedTo}...`);
    
    const result = await twilioClient.messages.create({
      body: message,
      from: fromNumber,
      to: formattedTo
    });

    console.log(`✅ SMS sent successfully. SID: ${result.sid}`);
    
    return {
      success: true,
      messageId: result.sid,
      status: result.status,
      to: formattedTo,
      from: fromNumber,
      body: message
    };

  } catch (error) {
    console.error('❌ Failed to send SMS:', error.message);
    return {
      success: false,
      error: error.message,
      to: to
    };
  }
}

/**
 * Send emergency SMS to tourist's emergency contact
 * @param {Object} emergencyContact - Emergency contact information
 * @param {string} touristName - Tourist's name
 * @param {string} touristId - Tourist's ID
 * @param {string} emergencyType - Type of emergency (sos, geofence_breach, etc.)
 * @param {string} location - Current location information
 * @returns {Promise<Object>} - SMS delivery result
 */
async function sendEmergencySMS(emergencyContact, touristName, touristId, emergencyType = 'sos', location = 'Demo Map Zone') {
  if (!emergencyContact || !emergencyContact.emergencyContactPhone) {
    return {
      success: false,
      error: 'Emergency contact phone number not available'
    };
  }

  let message = '';
  const timestamp = new Date().toLocaleString();
  
  switch (emergencyType) {
    case 'sos':
      message = `🚨 URGENT: ${touristName} has triggered SOS emergency!\n\n` +
                `Tourist ID: ${touristId}\n` +
                `Location: ${location}\n` +
                `Time: ${timestamp}\n\n` +
                `Please contact authorities immediately.\n\n` +
                `This is an automated alert from the Tourist Safety System.`;
      break;
      
    case 'geofence_breach':
      message = `⚠️ ALERT: ${touristName} entered a restricted area!\n\n` +
                `Tourist ID: ${touristId}\n` +
                `Location: ${location}\n` +
                `Time: ${timestamp}\n\n` +
                `Please check on ${touristName} if possible.\n\n` +
                `Tourist Safety System Alert.`;
      break;
      
    case 'geofence_exit':
      message = `✅ UPDATE: ${touristName} exited restricted area.\n\n` +
                `Tourist ID: ${touristId}\n` +
                `Location: ${location}\n` +
                `Time: ${timestamp}\n\n` +
                `Tourist Safety System Update.`;
      break;
      
    default:
      message = `📱 ALERT: ${touristName} - ${emergencyType}\n\n` +
                `Tourist ID: ${touristId}\n` +
                `Location: ${location}\n` +
                `Time: ${timestamp}\n\n` +
                `Tourist Safety System Alert.`;
  }

  return await sendSMS(
    emergencyContact.emergencyContactPhone,
    message,
    'Tourist Safety System'
  );
}

/**
 * Format phone number to E.164 format
 * @param {string} phoneNumber - Phone number to format
 * @returns {string|null} - Formatted phone number or null if invalid
 */
function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) return null;
  
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // If it starts with country code, return as is
  if (cleaned.length >= 10) {
    // Add + if not present
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  }
  
  // If it's a 10-digit US number, add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  return null;
}

/**
 * Check if SMS service is available
 * @returns {boolean} - True if SMS service is available
 */
function isSMSAvailable() {
  return smsEnabled && twilioClient !== null;
}

/**
 * Get SMS service status
 * @returns {Object} - SMS service status information
 */
function getSMSStatus() {
  return {
    enabled: smsEnabled,
    clientInitialized: twilioClient !== null,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || 'Not configured',
    accountSid: process.env.TWILIO_ACCOUNT_SID ? 'Configured' : 'Not configured'
  };
}

module.exports = {
  initializeSMS,
  sendSMS,
  sendEmergencySMS,
  formatPhoneNumber,
  isSMSAvailable,
  getSMSStatus
};


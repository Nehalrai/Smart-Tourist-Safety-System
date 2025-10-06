// test-sms.js - Test script for SMS functionality
require('dotenv').config();
const { initializeSMS, sendSMS, getSMSStatus } = require('./smsService');

async function testSMS() {
  console.log('🧪 Testing SMS Service...\n');
  
  // Check SMS status
  console.log('📊 SMS Status:');
  const status = getSMSStatus();
  console.log(JSON.stringify(status, null, 2));
  console.log('');
  
  // Initialize SMS service
  console.log('🔧 Initializing SMS service...');
  const initialized = initializeSMS();
  console.log(`SMS Service Initialized: ${initialized ? '✅' : '❌'}\n`);
  
  if (!initialized) {
    console.log('❌ SMS service not available. Please check your Twilio configuration.');
    console.log('   Make sure to set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your .env file');
    return;
  }
  
  // Test SMS (replace with your phone number)
  const testPhoneNumber = process.env.TEST_PHONE_NUMBER || '+1234567890';
  const testMessage = '🧪 Test SMS from Tourist Safety System - ' + new Date().toLocaleString();
  
  console.log(`📱 Sending test SMS to ${testPhoneNumber}...`);
  console.log(`Message: ${testMessage}\n`);
  
  try {
    const result = await sendSMS(testPhoneNumber, testMessage);
    
    if (result.success) {
      console.log('✅ SMS sent successfully!');
      console.log(`Message ID: ${result.messageId}`);
      console.log(`Status: ${result.status}`);
    } else {
      console.log('❌ SMS failed:');
      console.log(`Error: ${result.error}`);
    }
  } catch (error) {
    console.log('❌ SMS test failed:');
    console.log(`Error: ${error.message}`);
  }
}

// Run the test
testSMS().catch(console.error);


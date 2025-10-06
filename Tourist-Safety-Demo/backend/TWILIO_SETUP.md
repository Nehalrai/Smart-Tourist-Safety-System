# Twilio SMS Integration Setup

This guide explains how to set up Twilio SMS integration for the Tourist Safety Demo system.

## Overview

The system now supports real SMS notifications via Twilio API for emergency alerts. When a tourist triggers an SOS or enters a danger zone, the system will send real SMS messages to their emergency contact.

## Features

- ✅ **Real SMS Notifications** - Send actual SMS via Twilio
- ✅ **Emergency Alerts** - SOS and geofence breach notifications
- ✅ **Status Tracking** - Monitor SMS delivery status
- ✅ **Error Handling** - Graceful fallback when SMS unavailable
- ✅ **Phone Number Formatting** - Automatic E.164 format conversion
- ✅ **Encrypted Data** - Secure handling of contact information

## Prerequisites

1. **Twilio Account** - Sign up at [twilio.com](https://www.twilio.com)
2. **Phone Number** - Purchase a Twilio phone number
3. **Account Credentials** - Account SID and Auth Token

## Setup Instructions

### 1. Create Twilio Account

1. Go to [console.twilio.com](https://console.twilio.com)
2. Sign up for a free account (includes $15 credit)
3. Verify your phone number

### 2. Get Twilio Credentials

1. In Twilio Console, go to **Account** → **API Keys & Tokens**
2. Copy your **Account SID**
3. Copy your **Auth Token**

### 3. Purchase a Phone Number

1. In Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a number**
2. Choose a phone number with SMS capabilities
3. Note the phone number (e.g., +1234567890)

### 4. Configure Environment Variables

Create a `.env` file in the backend directory:

```bash
# Copy the example file
cp env.example .env
```

Edit `.env` and add your Twilio credentials:

```env
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# SMS Configuration
SMS_ENABLED=true
SMS_FROM_NAME=Tourist Safety System
```

### 5. Test the Integration

1. Start the backend server:
   ```bash
   npm start
   ```

2. Check SMS status:
   ```bash
   curl http://localhost:4000/api/sms/status
   ```

3. Test emergency SMS (replace with real tourist ID):
   ```bash
   curl -X POST http://localhost:4000/api/sms/emergency \
     -H "Content-Type: application/json" \
     -d '{"touristId": "TID-123456", "emergencyType": "sos"}'
   ```

## API Endpoints

### SMS Status
```
GET /api/sms/status
```
Returns SMS service availability and configuration status.

### Emergency SMS
```
POST /api/sms/emergency
```
Sends emergency SMS to tourist's emergency contact.

**Request Body:**
```json
{
  "touristId": "TID-123456",
  "emergencyType": "sos",
  "location": "Demo Map Zone"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Emergency SMS sent successfully",
  "smsResult": {
    "success": true,
    "messageId": "SM1234567890abcdef",
    "status": "sent",
    "to": "+1234567890",
    "from": "+1987654321"
  },
  "touristName": "John Doe"
}
```

## SMS Message Types

### SOS Emergency
```
🚨 URGENT: John Doe has triggered SOS emergency!

Tourist ID: TID-123456
Location: Demo Map Zone
Time: 10/5/2025, 12:00:00 PM

Please contact authorities immediately.

This is an automated alert from the Tourist Safety System.
```

### Geofence Breach
```
⚠️ ALERT: John Doe entered a restricted area!

Tourist ID: TID-123456
Location: Government Area
Time: 10/5/2025, 12:00:00 PM

Please check on John Doe if possible.

Tourist Safety System Alert.
```

### Geofence Exit
```
✅ UPDATE: John Doe exited restricted area.

Tourist ID: TID-123456
Location: Safe Zone
Time: 10/5/2025, 12:05:00 PM

Tourist Safety System Update.
```

## Phone Number Formatting

The system automatically formats phone numbers to E.164 format:

- **US Numbers**: `1234567890` → `+11234567890`
- **International**: `+44123456789` → `+44123456789`
- **Invalid**: `abc123` → `null` (error)

## Error Handling

### Common Issues

1. **Invalid Credentials**
   ```
   Error: Authentication failed
   Solution: Check Account SID and Auth Token
   ```

2. **Invalid Phone Number**
   ```
   Error: Invalid phone number format
   Solution: Ensure phone number is in correct format
   ```

3. **Insufficient Balance**
   ```
   Error: Account balance insufficient
   Solution: Add funds to Twilio account
   ```

4. **SMS Disabled**
   ```
   Status: SMS service is not available
   Solution: Set SMS_ENABLED=true in .env
   ```

## Security Considerations

1. **Environment Variables** - Never commit `.env` file to version control
2. **Credentials** - Store Twilio credentials securely
3. **Phone Numbers** - Encrypted in database
4. **Rate Limiting** - Consider implementing rate limits for SMS
5. **Cost Control** - Monitor SMS usage and costs

## Cost Management

### Twilio Pricing (US)
- **SMS to US**: ~$0.0075 per message
- **SMS International**: Varies by country
- **Phone Number**: ~$1.00/month

### Free Trial
- **$15 credit** included with new accounts
- **~2000 SMS messages** to US numbers
- **Perfect for testing and development**

## Monitoring and Logs

### Backend Logs
```bash
# Check SMS status
curl http://localhost:4000/api/sms/status

# View server logs
npm start
```

### Twilio Console
- **Monitor** → **Logs** → **Messaging**
- **Real-time delivery status**
- **Error tracking and debugging**

## Production Recommendations

1. **Use Environment-Specific Keys** - Different credentials for dev/staging/prod
2. **Implement Rate Limiting** - Prevent SMS spam
3. **Add Delivery Receipts** - Track message delivery status
4. **Monitor Costs** - Set up billing alerts
5. **Backup Communication** - Email fallback when SMS fails
6. **Compliance** - Ensure GDPR/CCPA compliance for international users

## Troubleshooting

### SMS Not Sending
1. Check Twilio credentials
2. Verify phone number format
3. Check account balance
4. Review Twilio logs

### Frontend Not Updating
1. Check API connectivity
2. Verify CORS settings
3. Check browser console for errors

### Backend Errors
1. Check environment variables
2. Verify Twilio SDK installation
3. Review server logs

## Support

- **Twilio Documentation**: [twilio.com/docs](https://www.twilio.com/docs)
- **Twilio Support**: [support.twilio.com](https://support.twilio.com)
- **Project Issues**: Check GitHub issues or contact development team


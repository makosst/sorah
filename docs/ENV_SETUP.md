# Environment Variables Setup

Create a `.env.local` file in the root of your project with these variables:

```bash
# Twilio Configuration
# Get these from https://console.twilio.com

# Your Twilio Account SID (starts with AC)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Your Twilio Auth Token
TWILIO_AUTH_TOKEN=your_auth_token_here

# Your Twilio Phone Number (the number you purchased)
TWILIO_PHONE_NUMBER=+1234567890

# Set to 'production' to enable real SMS, 'development' to use console
NODE_ENV=development
```

## Important Notes

1. **Never commit `.env.local` to Git** - it's already in `.gitignore`
2. Replace the placeholder values with your actual Twilio credentials
3. Keep `NODE_ENV=development` for testing (uses console)
4. Change to `NODE_ENV=production` when ready for real SMS

## Testing Modes

### Development Mode (`NODE_ENV=development`)
- OTP codes logged to console
- No SMS sent (saves credits)
- Perfect for testing

### Production Mode (`NODE_ENV=production`)
- Real SMS sent via Twilio
- Uses your Twilio credits
- For live users

## Getting Your Credentials

1. Sign up at https://www.twilio.com
2. Go to https://console.twilio.com
3. Copy your Account SID and Auth Token
4. Buy a phone number from Twilio
5. Add credentials to `.env.local`


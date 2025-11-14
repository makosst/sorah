# 📱 Twilio SMS Integration - Complete Setup Guide

## ✅ What's Already Done

I've successfully integrated Twilio into your authentication system! Here's what's working:

✅ Twilio SDK installed
✅ SMS sending function created  
✅ Development/Production mode switching  
✅ Automatic fallback to console in development  
✅ Code deployed to Convex  

## 🚀 How to Enable Real SMS

Follow these steps to start sending real SMS messages:

### Step 1: Create Twilio Account

1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up for a free account
3. Verify your email and phone number
4. You'll get **$15.12 in free credits!**

### Step 2: Get Your Credentials

1. Log in to [Twilio Console](https://console.twilio.com/)
2. On the dashboard, you'll see:
   - **Account SID**: Starts with `AC...` (copy this)
   - **Auth Token**: Click to reveal and copy
3. Keep these secure!

### Step 3: Get a Phone Number

#### For Testing (Free Trial)

1. In Twilio Console, go to: **Phone Numbers → Manage → Buy a number**
2. Select your country
3. Choose a phone number (costs ~$1-2/month, taken from your free credits)
4. Buy the number

**Important**: Trial accounts can only send SMS to **verified phone numbers**. To test:
- Go to **Phone Numbers → Manage → Verified Caller IDs**
- Add your phone number
- Enter the verification code sent to you

#### For Production (Upgrade Account)

1. Add a payment method
2. Buy a phone number
3. You can now send to ANY phone number (no verification needed)

### Step 4: Set Up Environment Variables

You need to configure Convex environment variables:

#### Option A: Using Convex Dashboard (Recommended)

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Select your project
3. Go to **Settings → Environment Variables**
4. Add these variables:

```
TWILIO_ACCOUNT_SID = ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN = your_auth_token_here
TWILIO_PHONE_NUMBER = +1234567890
NODE_ENV = production
```

#### Option B: Using Convex CLI

```bash
cd /Users/katedeyneka/Documents/ai_building/social_media_agent/sorah

# Set Twilio credentials
npx convex env set TWILIO_ACCOUNT_SID ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
npx convex env set TWILIO_AUTH_TOKEN your_auth_token_here
npx convex env set TWILIO_PHONE_NUMBER +1234567890

# Enable production mode (sends real SMS)
npx convex env set NODE_ENV production
```

### Step 5: Test SMS Sending

1. **Refresh your app** in the browser
2. Go to the auth page: `http://localhost:3000/auth`
3. Enter a phone number (must be verified if using trial)
4. Click "Send verification code"
5. **Check your phone!** You should receive an SMS 📱

The message will say:
```
Your Sorah verification code is: 123456. This code expires in 10 minutes.
```

### Step 6: Verify It Works

Check your Convex logs (terminal):
- ✅ You should see: `✅ SMS sent to +1234567890`
- ❌ If error: Check your credentials and phone number format

## 🔄 Switching Between Development and Production

### Development Mode (Current Default)
```bash
# Show OTP in console only (no SMS)
npx convex env set NODE_ENV development
```

**When to use:**
- Local testing
- Saving SMS credits
- Debugging

**Behavior:**
- OTP shown in console
- No SMS sent
- Free!

### Production Mode
```bash
# Send real SMS via Twilio
npx convex env set NODE_ENV production
```

**When to use:**
- Live app
- Real users
- Testing SMS delivery

**Behavior:**
- Real SMS sent via Twilio
- Costs ~$0.0075 per SMS
- Professional experience

## 💰 Costs

### Twilio Pricing
- **Phone number**: ~$1-2/month
- **SMS (US/Canada)**: $0.0075 per message
- **Free trial**: $15.12 credits (enough for ~2,000 SMS!)

### Example Costs
- 100 users sign up: ~$0.75
- 1,000 users sign up: ~$7.50
- 10,000 users sign up: ~$75

Very affordable! 🎉

## 🧪 Testing Checklist

### ✅ Development Mode Testing
1. Set `NODE_ENV=development`
2. Try to sign in
3. Check console for OTP code
4. Verify code works
5. Complete onboarding

### ✅ Production Mode Testing
1. Set Twilio credentials
2. Set `NODE_ENV=production`
3. Use a **verified phone number** (if trial account)
4. Try to sign in
5. Check your phone for SMS
6. Verify code works
7. Check Convex logs for `✅ SMS sent`

## 🐛 Troubleshooting

### Problem: "Twilio credentials not configured"
**Solution:** Make sure you set all three env variables:
```bash
npx convex env set TWILIO_ACCOUNT_SID your_sid
npx convex env set TWILIO_AUTH_TOKEN your_token
npx convex env set TWILIO_PHONE_NUMBER +1234567890
```

### Problem: "Failed to send SMS: [Error]"
**Solutions:**
1. **Phone format**: Must include country code: `+1234567890`
2. **Trial account**: Verify the recipient phone number first
3. **Credits**: Check you have Twilio credits remaining
4. **Phone number**: Verify your Twilio phone number is SMS-enabled

### Problem: SMS not received
**Check:**
1. Is phone number format correct? (`+` and country code)
2. Is phone number verified? (for trial accounts)
3. Do you have Twilio credits?
4. Check Twilio logs: [Twilio Console → Monitor → Logs](https://console.twilio.com/us1/monitor/logs/sms)

### Problem: "Rendered more hooks" error
**Solution:** This is fixed! But if it happens:
1. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. Clear cache
3. Restart dev server

## 📊 Monitoring SMS Delivery

### Convex Logs
```bash
# Watch logs in real-time
npx convex dev

# Look for:
✅ SMS sent to +1234567890
```

### Twilio Dashboard
1. Go to [Twilio Console → Monitor → Logs](https://console.twilio.com/us1/monitor/logs/sms)
2. See all SMS messages sent
3. Check delivery status
4. View costs

## 🔒 Security Best Practices

### ✅ Do:
- Keep credentials in environment variables (never in code)
- Use environment variables in Convex Dashboard
- Rotate Auth Token periodically
- Monitor SMS usage
- Set up billing alerts in Twilio

### ❌ Don't:
- Commit credentials to Git
- Share credentials publicly
- Use production credentials in development
- Leave credentials in console logs

## 📈 Production Checklist

Before launching to real users:

- [ ] Upgrade Twilio account (remove trial restrictions)
- [ ] Set all environment variables in Convex
- [ ] Set `NODE_ENV=production`
- [ ] Test SMS delivery with real phone numbers
- [ ] Set up Twilio billing alerts
- [ ] Monitor SMS costs
- [ ] Add rate limiting (optional)
- [ ] Test international phone numbers (if needed)

## 🎓 Next Steps

After SMS is working:

1. **Add Rate Limiting**
   - Limit OTP requests per phone number
   - Prevent abuse
   - See `NEXT_STEPS.md`

2. **Customize SMS Message**
   - Update message in `convex/phoneAuth.ts`
   - Add your branding
   - Include support link

3. **Add SMS Templates**
   - Welcome messages
   - Password resets
   - Notifications

4. **Monitor & Optimize**
   - Track delivery rates
   - Monitor costs
   - Optimize message content

## 🆘 Need Help?

- **Twilio Support**: [https://support.twilio.com](https://support.twilio.com)
- **Twilio Docs**: [https://www.twilio.com/docs/sms](https://www.twilio.com/docs/sms)
- **Convex Docs**: [https://docs.convex.dev](https://docs.convex.dev)

## 🎉 Summary

Your authentication system now supports:

✅ Real SMS via Twilio  
✅ Development/Production modes  
✅ Automatic fallback  
✅ Error handling  
✅ Production-ready  

**To activate real SMS:**
1. Sign up for Twilio
2. Get credentials (SID, Token, Phone)
3. Set environment variables in Convex
4. Set `NODE_ENV=production`
5. Test! 📱

You're ready to go live! 🚀


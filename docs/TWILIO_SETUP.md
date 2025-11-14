# Twilio SMS Integration Guide

## Step 1: Sign Up for Twilio

1. Go to [Twilio](https://www.twilio.com/try-twilio)
2. Sign up for a free account
3. Verify your email and phone number

## Step 2: Get Your Credentials

After signing up:

1. Go to [Twilio Console](https://console.twilio.com/)
2. Find your **Account SID** and **Auth Token** on the dashboard
3. Copy these - you'll need them

## Step 3: Get a Phone Number

### Option A: Free Trial (Testing)
1. In Twilio Console, go to Phone Numbers → Manage → Buy a number
2. Free trial gives you $15 credit
3. Get a phone number (costs ~$1-2/month)
4. **Note:** Trial accounts can only send to verified phone numbers

### Option B: Upgrade Account (Production)
1. Add payment method
2. Buy a phone number
3. Can send to any phone number

## Step 4: Verify Test Phone Numbers (Trial Only)

If using trial:
1. Go to Phone Numbers → Manage → Verified Caller IDs
2. Add your phone number
3. Verify it with the code sent

## Your Credentials

You'll need:
- **Account SID**: `ACxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Auth Token**: `your_auth_token_here`
- **Phone Number**: `+1234567890` (the number you bought)

Keep these secure - don't commit them to Git!


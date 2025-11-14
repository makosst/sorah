# Quick Start Guide

## 🚀 Your Authentication System is Ready!

I've successfully implemented phone-based authentication and onboarding for your Sorah application.

## ✅ What's Working Now

1. **Phone Authentication**
   - Users sign in with their mobile phone number
   - OTP (One-Time Password) verification
   - Automatic account creation for new users

2. **Onboarding Flow**
   - Step 1: Collect user's name
   - Step 2: Choose preferred style (playful/professional/travel)
   - Step 3: Record voice sample (optional)

3. **Protected Routes**
   - Automatic redirects based on auth state
   - User profile display on home page
   - Sign out functionality

## 🎯 How to Test (5 Minutes)

### Step 1: Start the Dev Server

```bash
npm run dev
```

Wait for: `✓ Ready in Xms`

### Step 2: Open Your Browser

Navigate to: `http://localhost:3000`

You should automatically be redirected to: `http://localhost:3000/auth`

### Step 3: Sign In

1. **Enter a phone number** (use any format with country code):
   ```
   +1234567890
   ```

2. **Click "Send verification code"**
   
3. **Open browser console** (Press F12)
   - Look for: `📱 OTP for +1234567890: 123456`
   - Copy the 6-digit code

4. **Enter the OTP code** and click "Verify code"

### Step 4: Complete Onboarding

**Page 1: Name**
- Enter your name (e.g., "Kate")
- Click "Continue"

**Page 2: Style**
- Choose one:
  - 🎨 Playful (fun, energetic, creative)
  - 💼 Professional (polished, business-focused)
  - ✈️ Travel (adventurous, wanderlust)
- Click "Continue"

**Page 3: Voice Recording** (Optional)
- Click "Start recording" and say something (or skip)
- Click "Stop recording"
- Click "Complete onboarding"

### Step 5: Success! 🎉

You should now see:
- Your profile in the top bar (avatar with your initial)
- Your name and chosen style
- The home page with all your projects

## 📱 Try These Actions

### Sign Out
- Click "sign out" in the top bar
- You'll be redirected to `/auth`

### Sign In Again
- Use the **same phone number**
- Enter the OTP from console
- You'll **skip onboarding** and go directly to home

### Test Different Users
- Sign out
- Use a **different phone number** (e.g., `+9876543210`)
- Complete onboarding again with different preferences

## 🎨 What You'll See

### Authentication Page (`/auth`)
```
┌─────────────────────────────────┐
│   welcome to sorah              │
│   sign in with your phone       │
│                                 │
│   Phone Number                  │
│   ┌───────────────────────────┐ │
│   │ +1234567890               │ │
│   └───────────────────────────┘ │
│                                 │
│   [Send verification code]      │
└─────────────────────────────────┘
```

### Onboarding Step 2 (`/onboarding`)
```
┌─────────────────────────────────┐
│   welcome aboard!               │
│   let's personalize your        │
│   experience                    │
│   ━━━━━━━━━━━━━━━━━━━━━━━━      │
│                                 │
│   choose your style             │
│                                 │
│   ┌───────────────────────────┐ │
│   │ 🎨  Playful               │ │
│   │ fun, energetic, creative  │ │
│   └───────────────────────────┘ │
│   ┌───────────────────────────┐ │
│   │ 💼  Professional          │ │
│   │ polished, business        │ │
│   └───────────────────────────┘ │
│   ┌───────────────────────────┐ │
│   │ ✈️  Travel                │ │
│   │ adventurous, wanderlust   │ │
│   └───────────────────────────┘ │
│                                 │
│   [Back]        [Continue]      │
└─────────────────────────────────┘
```

### Home Page (`/`)
```
┌─────────────────────────────────┐
│  K  Kate         sign out       │
│     Professional style           │
├─────────────────────────────────┤
│                                 │
│  turn your videos into magic    │
│  [create project]               │
│                                 │
│  projects                       │
│  ┌───────────────────────────┐ │
│  │ My Video Project          │ │
│  │ 3 files • Jan 15          │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
```

## 🔐 Development vs Production

### Current Setup (Development)
- ✅ OTP codes appear in browser console
- ✅ No SMS costs
- ✅ Perfect for testing
- ✅ Full authentication flow

### For Production
You'll need to:
1. Add SMS provider (Twilio/AWS SNS)
2. Store OTPs in database
3. Add rate limiting
4. See `IMPLEMENTATION_SUMMARY.md` for details

## 📂 Key Files

```
convex/
├── schema.ts          # Added users table
├── phoneAuth.ts       # OTP authentication logic
├── users.ts           # User management
└── http.ts            # Auth HTTP routes

src/
├── lib/
│   └── auth.tsx       # Auth context provider
└── app/
    ├── auth/
    │   └── page.tsx   # Sign-in page
    ├── onboarding/
    │   └── page.tsx   # Onboarding flow
    └── page.tsx       # Home (updated)
```

## 🐛 Quick Fixes

### Problem: Can't see OTP code
**Fix:** Open browser DevTools console (F12)

### Problem: Getting redirected in a loop
**Fix:** Open console and run:
```javascript
localStorage.clear()
```
Then refresh the page.

### Problem: Voice recording doesn't work
**Fix:** 
1. Allow microphone permissions when prompted
2. Use Chrome, Firefox, or Edge (not Safari)
3. Make sure you're on localhost or HTTPS

### Problem: "User already exists" or similar
**Fix:** This is normal - just means you're a returning user. You'll skip onboarding.

## 📖 Full Documentation

For complete details, see:
- `IMPLEMENTATION_SUMMARY.md` - Complete overview
- `docs/AUTHENTICATION.md` - Technical documentation

## ✨ What's Next?

Now that authentication is working, you can:

1. **Test the full flow** with different phone numbers
2. **Add SMS integration** when ready for production
3. **Customize the onboarding** questions if needed
4. **Use user preferences** (style) in your video generation

## 💡 Tips

- The OTP code is **always 6 digits** and shown in the console
- Codes **expire after 10 minutes**
- Voice recording is **optional** - you can skip it
- Sign out to test with different users
- All data is stored in Convex (users, preferences, voice recordings)

## 🎉 You're All Set!

Everything is ready to use. Just run `npm run dev` and start testing!

Need help? Check the documentation or the implementation notes in `IMPLEMENTATION_SUMMARY.md`.


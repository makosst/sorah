# Authentication & Onboarding System

This document explains the phone-based authentication and onboarding system implemented for the Sorah application.

## Overview

The application now features:
1. **Phone-based authentication** with OTP (One-Time Password) verification
2. **User onboarding flow** that collects:
   - User's name
   - Preferred content style (playful, professional, travel)
   - Voice recording sample (optional)
3. **Protected routes** that require authentication
4. **User profile management**

## Architecture

### Database Schema (`convex/schema.ts`)

The system uses two main tables:

#### Users Table
```typescript
users: defineTable({
  name: v.optional(v.string()),
  phone: v.optional(v.string()),
  preferredStyle: v.optional(v.union(
    v.literal("playful"),
    v.literal("professional"),
    v.literal("travel")
  )),
  voiceRecordingUrl: v.optional(v.string()),
  voiceRecordingStorageId: v.optional(v.id("_storage")),
  onboardingCompleted: v.boolean(),
  createdAt: v.number(),
}).index("by_phone", ["phone"])
```

#### Projects Table (Updated)
- Added `userId` field to associate projects with users
- Index on `userId` for efficient queries

### Authentication System

#### Phone Authentication (`convex/phoneAuth.ts`)

The system uses a custom OTP-based authentication:

1. **`sendOTP(phone)`** - Generates and stores a 6-digit OTP code
   - Code expires after 10 minutes
   - In development: Logs OTP to console
   - In production: Should integrate with SMS provider (Twilio, AWS SNS, etc.)

2. **`verifyOTP(phone, code)`** - Verifies the OTP code
   - Creates new user if doesn't exist
   - Returns userId and onboarding status

#### Client-Side Auth (`src/lib/auth.tsx`)

- Uses React Context for auth state management
- Stores userId in localStorage for persistence
- Provides `useAuth()` hook with:
  - `userId`: Current user's ID
  - `setUserId()`: Update authenticated user
  - `signOut()`: Clear authentication

### User Flows

#### 1. Authentication Flow (`/auth`)

```
┌─────────────────┐
│  Enter Phone    │
│  Number         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Send OTP       │
│  (Backend)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Enter OTP      │
│  Code           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Verify Code    │
│  (Backend)      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 New User   Existing
    │         User
    │         │
    ▼         ▼
Onboarding   Home
```

#### 2. Onboarding Flow (`/onboarding`)

The onboarding process consists of 3 steps:

**Step 1: Name**
- User enters their name

**Step 2: Preferred Style**
- User selects from:
  - 🎨 Playful (fun, energetic, creative)
  - 💼 Professional (polished, business-focused)
  - ✈️ Travel (adventurous, wanderlust)

**Step 3: Voice Recording**
- User can record a voice sample (optional)
- Uses browser's MediaRecorder API
- Recording is stored in Convex storage
- Can skip this step

After completion, user is redirected to the home page.

### Protected Routes

All pages check authentication status:

- **`/auth`** - Public, redirects authenticated users
- **`/onboarding`** - Requires authentication, redirects if completed
- **`/`** (Home) - Requires authentication + completed onboarding
- **`/upload`** - Requires authentication + completed onboarding

### API Functions

#### `convex/users.ts`

- `getCurrentUser(userId)` - Get user profile
- `completeOnboarding(userId, name, preferredStyle, voiceRecordingStorageId)` - Complete onboarding
- `generateUploadUrl()` - Get URL for uploading voice recording
- `updateProfile(userId, name, preferredStyle)` - Update user profile

#### `convex/phoneAuth.ts`

- `sendOTP(phone)` - Send OTP code to phone
- `verifyOTP(phone, code)` - Verify OTP and authenticate
- `getUserByPhone(phone)` - Query user by phone number

## Development vs Production

### Development Mode

- OTP codes are logged to the browser console
- Alert shown to user: "Check the browser console for the OTP code"
- No actual SMS sending required

### Production Setup

To use in production, you need to:

1. **Integrate SMS Provider**

   Update `convex/phoneAuth.ts`:

   ```typescript
   export const sendOTP = action({
     args: { phone: v.string() },
     handler: async (ctx, args) => {
       const code = generateOTP();
       
       // Store in database instead of in-memory
       await ctx.db.insert("otpCodes", {
         phone: args.phone,
         code,
         expiresAt: Date.now() + 10 * 60 * 1000
       });
       
       // Send SMS via Twilio
       await sendSMSViaTwilio(args.phone, code);
       
       return { success: true };
     },
   });
   ```

2. **Add OTP Storage Table**

   Update `convex/schema.ts`:

   ```typescript
   otpCodes: defineTable({
     phone: v.string(),
     code: v.string(),
     expiresAt: v.number(),
   }).index("by_phone", ["phone"])
   ```

3. **Environment Variables**

   Add to `.env.local`:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone
   ```

## Testing

### Manual Testing

1. Navigate to `/auth`
2. Enter a phone number (e.g., `+1234567890`)
3. Click "Send verification code"
4. Check browser console for OTP code
5. Enter the code
6. Complete onboarding with name, style, and optional voice recording
7. Verify profile shows on home page

### Test Data

```javascript
// Valid test phone numbers
+1234567890
+1555123456
+44123456789

// Test users will be created automatically
```

## User Experience

### Visual Design

- **Color scheme**: Purple-to-blue gradient (professional, modern)
- **Authentication**: Clean, centered card layout
- **Onboarding**: Step-by-step progress indicators
- **Profile bar**: Shows user name, style, and avatar

### Accessibility

- Proper form labels
- Keyboard navigation support
- Loading states for all async operations
- Error messages for failed operations

## Security Considerations

1. **OTP Expiration**: Codes expire after 10 minutes
2. **Storage**: Phone numbers are indexed for quick lookup
3. **Client Storage**: UserId stored in localStorage (consider upgrading to httpOnly cookies)
4. **Rate Limiting**: Should add rate limiting in production
5. **Phone Validation**: Add server-side phone number validation

## Future Improvements

1. **SMS Integration**: Add Twilio or similar service
2. **Session Management**: Implement proper session tokens
3. **2FA**: Add additional security layers
4. **Profile Editing**: Allow users to update profile post-onboarding
5. **Phone Verification**: Verify phone numbers are valid/reachable
6. **Rate Limiting**: Prevent OTP abuse
7. **Analytics**: Track authentication and onboarding completion rates

## Troubleshooting

### Common Issues

1. **OTP not showing in console**
   - Check browser console is open
   - Verify phone number format includes country code

2. **Infinite redirect loop**
   - Clear localStorage: `localStorage.clear()`
   - Refresh the page

3. **Voice recording not working**
   - Grant microphone permissions
   - Use HTTPS or localhost
   - Check browser compatibility (Chrome, Firefox, Edge)

4. **User stuck on onboarding**
   - Complete all three steps
   - Check network requests for errors

## File Structure

```
convex/
  ├── schema.ts          # Database schema
  ├── auth.ts            # Convex Auth config (minimal setup)
  ├── phoneAuth.ts       # Phone OTP authentication
  ├── users.ts           # User management functions
  └── http.ts            # HTTP routes for auth

src/
  ├── lib/
  │   └── auth.tsx       # Client-side auth context
  └── app/
      ├── auth/
      │   └── page.tsx   # Authentication page
      ├── onboarding/
      │   └── page.tsx   # Onboarding flow
      └── page.tsx       # Protected home page
```

## Support

For issues or questions, please refer to:
- Convex Documentation: https://docs.convex.dev
- Project Repository: [Add your repo URL]


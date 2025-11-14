# Quick Twilio Setup - Avoid Toll-Free Verification

## Problem
You're getting "Toll-free verification for messaging is required" because you're trying to use a toll-free number.

## Solution: Buy a Local Number

### Step 1: Release Your Toll-Free Number (Optional)
If you already bought a toll-free number:
1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click on your toll-free number (starts with +1800, +1888, etc.)
3. Click "Release this number"
4. Confirm (you'll get a refund if you just bought it)

### Step 2: Buy a Local Number

1. **Go to**: https://console.twilio.com/us1/develop/phone-numbers/manage/search

2. **Configure search:**
   - Country: United States (or your country)
   - ❌ UNCHECK "Toll-Free" 
   - ✅ CHECK "SMS" capability
   - Optional: Choose specific area code (like 415, 212, 310)

3. **Click "Search"**

4. **Pick a number** from the results:
   - Look for numbers like: +1 (415) 555-1234
   - NOT like: +1 (800) 555-1234 or +1 (888) 555-1234

5. **Click "Buy"** (~$1/month from your free credits)

### Step 3: Update Your Environment Variable

```bash
cd /Users/katedeyneka/Documents/ai_building/social_media_agent/sorah

# Replace with YOUR new local number
npx convex env set TWILIO_PHONE_NUMBER +14155551234
```

### Step 4: For Trial Account - Verify Test Numbers

If you're on a trial account, you can only send to verified numbers:

1. **Go to**: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
2. **Click**: "Add a new number" or "Verify a new Caller ID"
3. **Enter**: Your phone number (the one you want to test with)
4. **Verify**: Enter the code sent to you
5. ✅ Now you can send SMS to this number!

## Quick Test

After setup:
1. Go to your app: `http://localhost:3000/auth`
2. Enter the verified phone number
3. Click "Send verification code"
4. Check your phone! 📱

## Number Types Comparison

| Type | Example | Requires Verification? | Cost | Best For |
|------|---------|----------------------|------|----------|
| **Local** | +1 415-555-1234 | ❌ No | ~$1/mo | ✅ Testing & Production |
| **Toll-Free** | +1 800-555-1234 | ✅ Yes (2-5 days) | ~$2/mo | Large scale only |
| **Trial (any)** | Any number | ❌ No* | Free | ✅ Development |

*Trial accounts can send to verified numbers only

## Tips

### For Development (Recommended)
- Use trial account
- Buy a local number ($1/month)
- Verify your personal phone number
- Test with that number
- **No toll-free verification needed!** ✅

### For Production
- Upgrade account (remove trial limits)
- Keep using your local number
- Can send to any phone number (no verification needed)
- **Still no toll-free verification needed!** ✅

### Only Get Toll-Free If
- You expect high volume (10,000+ SMS/month)
- You want a memorable number
- You have 2-5 days to wait for verification

## Common Mistakes

❌ **Don't**: Buy a toll-free number for testing
✅ **Do**: Buy a local number - works immediately

❌ **Don't**: Wait for toll-free verification
✅ **Do**: Start with verified caller IDs on trial

❌ **Don't**: Use +1-800, +1-888, +1-877, etc.
✅ **Do**: Use regular area codes like +1-415, +1-212, etc.

## Summary

**Quick Path (5 minutes):**
1. Buy local number with SMS capability
2. Verify your personal phone number (trial accounts)
3. Update `TWILIO_PHONE_NUMBER` in Convex
4. Test immediately! 📱

**No toll-free verification needed!** ✨


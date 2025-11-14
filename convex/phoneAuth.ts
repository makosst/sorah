"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import Twilio from "twilio";

// Generate a 6-digit OTP code (for development mode)
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP using Twilio Verify (recommended for production)
async function sendVerifyOTP(phone: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !verifyServiceSid) {
    throw new Error(
      "Twilio Verify not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID in your environment variables."
    );
  }

  const client = Twilio(accountSid, authToken);

  try {
    await client.verify.v2
      .services(verifyServiceSid)
      .verifications.create({
        to: phone,
        channel: "sms",
      });
  } catch (error: any) {
    console.error("Twilio Verify error:", error);
    throw new Error(`Failed to send verification: ${error.message}`);
  }
}

// Send OTP code via SMS
export const sendOTP = action({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    // Check if we should use Twilio Verify or development mode
    const useTwilioVerify = 
      process.env.USE_TWILIO_VERIFY === "true" || 
      process.env.NODE_ENV === "production";

    if (useTwilioVerify) {
      // Production: Use Twilio Verify (no phone number needed!)
      try {
        await sendVerifyOTP(args.phone);
        console.log(`✅ Twilio Verify OTP sent to ${args.phone}`);
        return { 
          success: true, 
          message: "OTP sent via SMS",
          useTwilioVerify: true 
        };
      } catch (error: any) {
        console.error("Failed to send via Twilio Verify:", error);
        // Fallback to development mode
        const code = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000;
        await ctx.runMutation(internal.users.storeOTP, {
          phone: args.phone,
          code,
          expiresAt,
        });
        console.log(`📱 OTP for ${args.phone}: ${code} (Twilio Verify failed, using console)`);
        return { 
          success: true, 
          message: "OTP sent (check console)", 
          error: error.message,
          useTwilioVerify: false
        };
      }
    } else {
      // Development: Generate and store OTP locally
      const code = generateOTP();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      await ctx.runMutation(internal.users.storeOTP, {
        phone: args.phone,
        code,
        expiresAt,
      });

      console.log(`📱 OTP for ${args.phone}: ${code}`);
      console.log(`💡 Development mode: Set USE_TWILIO_VERIFY=true to send real SMS`);
      return { 
        success: true, 
        message: "OTP logged to console (development mode)",
        useTwilioVerify: false
      };
    }
  },
});


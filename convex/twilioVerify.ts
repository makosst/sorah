"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import Twilio from "twilio";

// Verify OTP using Twilio Verify
export const verifyTwilioOTP = action({
  args: {
    phone: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    if (!accountSid || !authToken || !verifyServiceSid) {
      throw new Error("Twilio Verify not configured");
    }

    const client = Twilio(accountSid, authToken);

    try {
      const verificationCheck = await client.verify.v2
        .services(verifyServiceSid)
        .verificationChecks.create({
          to: args.phone,
          code: args.code,
        });

      if (verificationCheck.status === "approved") {
        // OTP is valid, create or get user
        const result = await ctx.runMutation(internal.users.getOrCreateUser, {
          phone: args.phone,
        });

        return {
          success: true,
          userId: result.userId,
          onboardingCompleted: result.onboardingCompleted,
        };
      } else {
        throw new Error("Invalid verification code");
      }
    } catch (error: any) {
      console.error("Twilio Verify check error:", error);
      throw new Error(`Verification failed: ${error.message}`);
    }
  },
});


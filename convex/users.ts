import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// Internal mutation to store OTP in database (used by phoneAuth)
export const storeOTP = internalMutation({
  args: {
    phone: v.string(),
    code: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Delete any existing OTPs for this phone
    const existingOTPs = await ctx.db
      .query("otpCodes")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .collect();
    
    for (const otp of existingOTPs) {
      await ctx.db.delete(otp._id);
    }

    // Insert new OTP
    await ctx.db.insert("otpCodes", {
      phone: args.phone,
      code: args.code,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });
  },
});

// Internal mutation to get or create user (used by Twilio Verify)
export const getOrCreateUser = internalMutation({
  args: {
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user exists
    let user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();

    // Create user if doesn't exist
    if (!user) {
      const userId = await ctx.db.insert("users", {
        phone: args.phone,
        onboardingCompleted: false,
        createdAt: Date.now(),
      });
      user = await ctx.db.get(userId);
    }

    return {
      userId: user?._id,
      onboardingCompleted: user?.onboardingCompleted || false,
    };
  },
});

// Verify OTP and create/get user (for development mode with local OTP storage)
export const verifyOTP = mutation({
  args: {
    phone: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    // Find OTP in database
    const storedOTP = await ctx.db
      .query("otpCodes")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();
    
    if (!storedOTP) {
      throw new Error("OTP not found. Please request a new code.");
    }

    if (Date.now() > storedOTP.expiresAt) {
      await ctx.db.delete(storedOTP._id);
      throw new Error("OTP expired. Please request a new code.");
    }

    if (storedOTP.code !== args.code) {
      throw new Error("Invalid OTP code.");
    }

    // OTP is valid, delete it
    await ctx.db.delete(storedOTP._id);

    // Check if user exists
    let user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();

    // Create user if doesn't exist
    if (!user) {
      const userId = await ctx.db.insert("users", {
        phone: args.phone,
        onboardingCompleted: false,
        createdAt: Date.now(),
      });
      user = await ctx.db.get(userId);
    }

    return { 
      success: true, 
      userId: user?._id,
      onboardingCompleted: user?.onboardingCompleted || false 
    };
  },
});

// Get current user by ID
export const getCurrentUser = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if (!args.userId) {
      return null;
    }
    return await ctx.db.get(args.userId);
  },
});

// Complete onboarding by updating user profile
export const completeOnboarding = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    preferredStyle: v.union(
      v.literal("playful"),
      v.literal("professional"),
      v.literal("travel")
    ),
    voiceRecordingStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    // Get the storage URL for the voice recording
    let voiceRecordingUrl: string | undefined;
    if (args.voiceRecordingStorageId) {
      voiceRecordingUrl = await ctx.storage.getUrl(args.voiceRecordingStorageId);
    }

    await ctx.db.patch(args.userId, {
      name: args.name,
      preferredStyle: args.preferredStyle,
      voiceRecordingStorageId: args.voiceRecordingStorageId,
      voiceRecordingUrl: voiceRecordingUrl || undefined,
      onboardingCompleted: true,
    });

    return { success: true };
  },
});

// Generate upload URL for voice recording
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Update user profile
export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    preferredStyle: v.optional(
      v.union(
        v.literal("playful"),
        v.literal("professional"),
        v.literal("travel")
      )
    ),
  },
  handler: async (ctx, args) => {
    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.preferredStyle !== undefined) updates.preferredStyle = args.preferredStyle;

    await ctx.db.patch(args.userId, updates);
    return { success: true };
  },
});

// Get user by phone (for authentication check)
export const getUserByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();
  },
});


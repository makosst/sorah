import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  otpCodes: defineTable({
    phone: v.string(),
    code: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_phone", ["phone"]),
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
    elevenlabsVoiceId: v.optional(v.string()),
    voicePreviewStorageId: v.optional(v.id("_storage")),
    selectedVoiceId: v.optional(v.string()), // The voice ID currently selected for use (custom or default)
    onboardingCompleted: v.boolean(),
    createdAt: v.number(),
  }).index("by_phone", ["phone"]),
  defaultVoices: defineTable({
    voiceId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    previewStorageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  }).index("by_voiceId", ["voiceId"]),
  tasks: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
  }),
  projects: defineTable({
    userId: v.optional(v.id("users")),
    prompt: v.string(),
    files: v.array(v.id("_storage")),
    fileMetadata: v.optional(v.array(v.object({
      storageId: v.id("_storage"),
      filename: v.string(),
      contentType: v.string(),
      size: v.number(),
    }))),
    thumbnail: v.optional(v.id("_storage")),
    createdAt: v.number(),
    status: v.optional(
      v.union(
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("rendering")
      )
    ),
    completedAt: v.optional(v.number()),
    script: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    srtContent: v.optional(v.string()),
    musicUrl: v.optional(v.string()),
    videoUrls: v.optional(v.array(v.string())),
    error: v.optional(v.string()),
    reelfulApiUrl: v.optional(v.string()),
    renderedVideoUrl: v.optional(v.string()),
    renderProgress: v.optional(
      v.object({
        step: v.string(),
        details: v.optional(v.string()),
        timestamp: v.number(),
      })
    ),
    sandboxId: v.optional(v.string()),
    sandboxStatus: v.optional(v.union(
      v.literal("alive"),
      v.literal("dead")
    )),
    renderStep: v.optional(v.union(
      v.literal("not_started"),
      v.literal("creating_sandbox"),
      v.literal("uploading_media"),
      v.literal("editing_sequence"),
      v.literal("rendering_video"),
      v.literal("completed"),
      v.literal("failed")
    )),
    renderError: v.optional(v.string()),
  }).index("by_user", ["userId"]),
});


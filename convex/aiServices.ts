"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { fal } from "@fal-ai/client";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { api } from "./_generated/api";
import { prompts } from "./prompts";

export const transcribeAudio = action({
  args: {
    audioUrl: v.string(),
  },
  handler: async (ctx, { audioUrl }) => {
    console.log("[transcribe] fetching audio from:", audioUrl);
    
    try {
      const audioResponse = await fetch(audioUrl);
      const audioBlob = await audioResponse.blob();
      
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.mp3");

      const response = await fetch("https://reels-srt.vercel.app/api/fireworks", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`transcription failed: ${response.statusText}`);
      }

      const srtText = await response.text();
      console.log("[transcribe] transcription complete");

      return { success: true, srt: srtText };
    } catch (error) {
      console.error("[transcribe] error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "transcription failed",
      };
    }
  },
});

export const animateImage = action({
  args: {
    imageUrl: v.string(),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, { imageUrl, prompt = prompts.imageAnimation.default }) => {
    console.log("[animate] ========================================");
    console.log("[animate] Starting image animation");
    console.log("[animate] Image URL:", imageUrl.substring(0, 100));
    console.log("[animate] Prompt:", prompt);
    console.log("[animate] ========================================");
    
    try {
      const apiKey = process.env.FAL_API_KEY;
      if (!apiKey) {
        console.error("[animate] ❌ FAL_API_KEY not set in environment variables");
        throw new Error("FAL_API_KEY not set");
      }
      console.log("[animate] ✓ FAL_API_KEY found");

      fal.config({ credentials: apiKey });

      console.log("[animate] Step 1: Fetching image to upload to FAL storage");
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        console.error("[animate] ❌ Failed to fetch image:", imageResponse.status, imageResponse.statusText);
        throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
      }
      const imageBlob = await imageResponse.blob();
      console.log("[animate] ✓ Image fetched, size:", (imageBlob.size / 1024 / 1024).toFixed(2), "MB");
      
      console.log("[animate] Step 2: Uploading image to FAL storage");
      const falImageUrl = await fal.storage.upload(imageBlob);
      console.log("[animate] ✓ Image uploaded to FAL storage:", falImageUrl);

      console.log("[animate] Step 3: Calling FAL API to animate image");
      console.log("[animate] API endpoint: fal-ai/kling-video/v2.5-turbo/pro/image-to-video");
      console.log("[animate] Request params:", JSON.stringify({ prompt, image_url: falImageUrl }, null, 2));
      
      const result = await fal.subscribe("fal-ai/kling-video/v2.5-turbo/pro/image-to-video", {
        input: {
          prompt,
          image_url: falImageUrl,
        },
        logs: true,
        onQueueUpdate: (update) => {
          console.log("[animate] Queue status:", update.status);
          if (update.status === "IN_PROGRESS") {
            update.logs.map((log) => log.message).forEach((msg) => console.log("[animate] FAL log:", msg));
          }
          if (update.status === "IN_QUEUE") {
            console.log("[animate] Position in queue:", (update as any).position);
          }
        },
      });

      console.log("[animate] ✓ FAL API call completed");
      console.log("[animate] Result structure:", JSON.stringify({
        requestId: result.requestId,
        hasData: !!result.data,
        dataKeys: result.data ? Object.keys(result.data) : [],
      }, null, 2));
      
      if (result.data) {
        const data = result.data as any;
        console.log("[animate] Result data:", JSON.stringify(result.data, null, 2));
        
        if (data.video && data.video.url) {
          console.log("[animate] ✓ Video URL found:", data.video.url);
        } else {
          console.error("[animate] ❌ No video URL in result data!");
          console.error("[animate] Full data:", JSON.stringify(result.data, null, 2));
        }
      }

      console.log("[animate] ========================================");
      console.log("[animate] Animation complete - SUCCESS");
      console.log("[animate] ========================================");
      return { success: true, data: result.data, requestId: result.requestId };
    } catch (error) {
      console.error("[animate] ========================================");
      console.error("[animate] ❌ ERROR during animation");
      console.error("[animate] Error type:", error?.constructor?.name);
      console.error("[animate] Error message:", error instanceof Error ? error.message : String(error));
      
      if (error && typeof error === 'object') {
        if ('body' in error) {
          console.error("[animate] Error body:", JSON.stringify((error as { body: unknown }).body, null, 2));
        }
        if ('response' in error) {
          console.error("[animate] Error response:", JSON.stringify((error as { response: unknown }).response, null, 2));
        }
        if ('statusCode' in error) {
          console.error("[animate] Status code:", (error as { statusCode: unknown }).statusCode);
        }
        // Log all error properties
        console.error("[animate] Error keys:", Object.keys(error));
        console.error("[animate] Full error:", JSON.stringify(error, null, 2));
      }
      
      console.error("[animate] Stack trace:", error instanceof Error ? error.stack : 'N/A');
      console.error("[animate] ========================================");
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "animation failed",
      };
    }
  },
});

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function convertTimestampsToSRT(characters: string[], startTimes: number[], endTimes: number[]): string {
  let srt = "";
  let index = 1;
  let currentWord = "";
  let wordStartTime = 0;
  let wordEndTime = 0;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    
    if (char === " " || i === characters.length - 1) {
      if (i === characters.length - 1 && char !== " ") {
        currentWord += char;
        wordEndTime = endTimes[i];
      }
      
      if (currentWord.trim().length > 0) {
        const startTime = formatTime(wordStartTime);
        const endTime = formatTime(wordEndTime);
        
        srt += `${index}\n`;
        srt += `${startTime} --> ${endTime}\n`;
        srt += `${currentWord.trim()}\n\n`;
        index++;
      }
      
      currentWord = "";
      if (i < characters.length - 1) {
        wordStartTime = startTimes[i + 1];
      }
    } else {
      if (currentWord === "") {
        wordStartTime = startTimes[i];
      }
      currentWord += char;
      wordEndTime = endTimes[i];
    }
  }

  return srt;
}

export const generateVoiceover = action({
  args: {
    text: v.string(),
    voiceId: v.optional(v.string()),
  },
  handler: async (ctx, { text, voiceId = "J5Tvc0PBEsF1Qd2KBTey" }): Promise<{ success: boolean; audioUrl?: string | null; durationMs?: number; srtContent?: string; error?: string }> => {
    console.log("[voiceover] generating voiceover with timestamps");
    
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        throw new Error("ELEVENLABS_API_KEY not set");
      }

      const client = new ElevenLabsClient({
        apiKey,
      });

      const result = await client.textToSpeech.convertWithTimestamps(voiceId, {
        text,
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128",
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 1.0,
          style: 0.0,
          useSpeakerBoost: true,
          speed: 1.2,
        },
      });

      console.log("[voiceover] voiceover generated with timestamps");
      
      const audioBuffer = Buffer.from(result.audioBase64, 'base64');
      console.log("[voiceover] audio size:", audioBuffer.length);
      
      const bitrate = 128000;
      const durationMs = Math.floor((audioBuffer.length * 8 / bitrate) * 1000);
      console.log("[voiceover] estimated duration:", durationMs, "ms");
      
      let srtContent: string | undefined;
      if (result.alignment) {
        console.log("[voiceover] converting timestamps to SRT");
        srtContent = convertTimestampsToSRT(
          result.alignment.characters,
          result.alignment.characterStartTimesSeconds,
          result.alignment.characterEndTimesSeconds
        );
        // Replace ??? back to ? for display in subtitles
        srtContent = srtContent.replace(/\?\?\?/g, '?');
        console.log("[voiceover] SRT generated, length:", srtContent.length, "chars");
      }
      
      const uploadUrl = await ctx.runMutation(api.tasks.generateUploadUrl, {});
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "audio/mp3" },
        body: audioBuffer,
      });
      const { storageId } = await uploadResponse.json();
      const audioUrl = await ctx.storage.getUrl(storageId);
      
      console.log("[voiceover] voiceover uploaded to storage");
      return { success: true, audioUrl, durationMs, srtContent };
    } catch (error) {
      console.error("[voiceover] error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "voiceover generation failed",
      };
    }
  },
});

export const generateMusic = action({
  args: {
    prompt: v.string(),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, { prompt, durationMs = 15000 }): Promise<{ success: boolean; musicUrl?: string | null; error?: string }> => {
    console.log("[music] generating background music");
    
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        throw new Error("ELEVENLABS_API_KEY not set");
      }

      const client = new ElevenLabsClient({
        apiKey,
      });

      const audioStream = await client.music.compose({
        prompt,
        musicLengthMs: durationMs,
      });

      const chunks: Uint8Array[] = [];
      const reader = audioStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const audioBuffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        audioBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      console.log("[music] music generated, size:", audioBuffer.length);
      
      const uploadUrl = await ctx.runMutation(api.tasks.generateUploadUrl, {});
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "audio/mp3" },
        body: audioBuffer,
      });
      const { storageId } = await uploadResponse.json();
      const musicUrl = await ctx.storage.getUrl(storageId);
      
      console.log("[music] music uploaded to storage");
      return { success: true, musicUrl };
    } catch (error) {
      console.error("[music] error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "music generation failed",
      };
    }
  },
});

/**
 * Helper function to check if a URL is a video based on extension
 */
function isVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v'];
  const urlLower = url.toLowerCase();
  return videoExtensions.some(ext => urlLower.includes(ext));
}

/**
 * Checks image size and returns URL if acceptable for OpenAI
 * Simple approach without external compression dependencies
 */
async function validateImageForOpenAI(imageUrl: string): Promise<string | null> {
  const OPENAI_MAX_SIZE = 20 * 1024 * 1024; // 20MB safe limit (OpenAI allows 32MB)
  
  try {
    // Check file size
    const headResponse = await fetch(imageUrl, { method: 'HEAD' });
    const contentLength = headResponse.headers.get('content-length');
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength);
      const sizeMB = (sizeInBytes / 1024 / 1024).toFixed(2);
      
      if (sizeInBytes <= OPENAI_MAX_SIZE) {
        console.log(`[validate] ✓ image ok: ${sizeMB} MB`);
        return imageUrl;
      } else {
        console.warn(`[validate] ✗ image too large: ${sizeMB} MB (max: 20MB)`);
        return null;
      }
    } else {
      // If we can't determine size, try to use it anyway
      console.log("[validate] ⚠ couldn't determine size, will try anyway");
      return imageUrl;
    }
  } catch (error) {
    console.error("[validate] error checking image:", error);
    // Return URL and let OpenAI handle it
    return imageUrl;
  }
}

/**
 * Extracts frames from a video at 25%, 50%, and 75% duration
 * Uses the Reels SRT API with FFmpeg
 */
async function extractVideoFrames(videoUrl: string, ctx: any): Promise<string[]> {
  console.log("[extractFrames] extracting frames from video...");
  
  try {
    // Download the video
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video: ${videoResponse.statusText}`);
    }
    const videoBlob = await videoResponse.blob();
    const videoSizeMB = (videoBlob.size / 1024 / 1024).toFixed(2);
    console.log(`[extractFrames] video size: ${videoSizeMB} MB`);

    const frames: string[] = [];
    const timestamps = ['25%', '50%', '75%'];
    
    for (let i = 0; i < timestamps.length; i++) {
      try {
        const formData = new FormData();
        formData.append("file", videoBlob, "video.mp4");
        formData.append("timestamp", timestamps[i]);
        formData.append("action", "extract-frame");

        console.log(`[extractFrames] requesting frame ${i + 1}/3 at ${timestamps[i]}...`);
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
        
        const response = await fetch("https://reels-srt.vercel.app/api/extract-frame", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const frameBlob = await response.blob();
          const frameSizeMB = (frameBlob.size / 1024 / 1024).toFixed(2);
          console.log(`[extractFrames] frame ${i + 1}: ${frameSizeMB} MB`);
          
          // Upload frame to storage
          const uploadUrl = await ctx.runMutation(api.tasks.generateUploadUrl, {});
          const uploadResponse = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": "image/jpeg" },
            body: frameBlob,
          });
          const { storageId } = await uploadResponse.json();
          const frameUrl = await ctx.storage.getUrl(storageId);
          
          if (frameUrl) {
            frames.push(frameUrl);
            console.log(`[extractFrames] ✓ frame ${i + 1} stored`);
          }
        } else {
          console.warn(`[extractFrames] frame ${i + 1} failed: ${response.status}`);
        }
      } catch (frameError: any) {
        if (frameError.name === 'AbortError') {
          console.warn(`[extractFrames] frame ${i + 1} timed out`);
        } else {
          console.error(`[extractFrames] frame ${i + 1} error:`, frameError);
        }
      }
    }
    
    console.log(`[extractFrames] ✓ extracted ${frames.length}/3 frames`);
    return frames;
    
  } catch (error) {
    console.error("[extractFrames] error:", error);
    return [];
  }
}

export const generateScript = action({
  args: {
    prompt: v.string(),
    imageUrls: v.optional(v.array(v.string())),
    style: v.optional(v.string()),
  },
  handler: async (ctx, { prompt, imageUrls = [], style = "professional" }) => {
    console.log("[script] generating script for prompt:", prompt);
    console.log("[script] processing", imageUrls.length, "media files");
    
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY not set");
      }

      const openai = createOpenAI({ apiKey });

      // Separate images from videos
      const images: string[] = [];
      const videos: string[] = [];
      const videoFrames: string[] = [];
      
      for (const url of imageUrls) {
        if (isVideoUrl(url)) {
          videos.push(url);
          // Extract 3 frames from each video
          const frames = await extractVideoFrames(url, ctx);
          videoFrames.push(...frames);
        } else {
          images.push(url);
        }
      }
      
      console.log("[script] found", images.length, "images and", videos.length, "videos");
      console.log("[script] extracted", videoFrames.length, "frames from videos");

      // Validate images for OpenAI Vision API (check size limits)
      console.log("[script] validating images for OpenAI Vision API...");
      const validImages: string[] = [];
      
      for (let i = 0; i < images.length; i++) {
        console.log(`[script] checking image ${i + 1}/${images.length}`);
        const validUrl = await validateImageForOpenAI(images[i]);
        if (validUrl) {
          validImages.push(validUrl);
        } else {
          console.warn(`[script] skipping image ${i + 1} (too large)`);
        }
      }
      
      // Validate video frames too
      const validFrames: string[] = [];
      for (let i = 0; i < videoFrames.length; i++) {
        const validUrl = await validateImageForOpenAI(videoFrames[i]);
        if (validUrl) {
          validFrames.push(validUrl);
        }
      }
      
      console.log(`[script] ✓ ready: ${validImages.length}/${images.length} images + ${validFrames.length}/${videoFrames.length} frames`)

      // Build content array for vision API
      // NOTE: We need to convert images to base64 because Convex URLs are private/expire
      type ContentPart = { type: "text"; text: string } | { type: "image"; image: string | URL };
      const userPromptText = prompts.scriptGeneration.user(prompt, style);
      const contentParts: ContentPart[] = [
        { type: "text", text: userPromptText }
      ];
      
      console.log("[script] converting images to base64 for OpenAI...");
      
      // Convert valid images to base64
      for (let i = 0; i < validImages.length; i++) {
        try {
          const imageUrl = validImages[i];
          console.log(`[script] downloading image ${i + 1}/${validImages.length}...`);
          
          const response = await fetch(imageUrl);
          if (!response.ok) {
            console.warn(`[script] failed to fetch image ${i + 1}: ${response.statusText}`);
            continue;
          }
          
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // Validate it's actually an image by checking magic bytes
          const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
          const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
          const isGIF = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
          const isWEBP = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
          
          if (!isJPEG && !isPNG && !isGIF && !isWEBP) {
            console.warn(`[script] image ${i + 1} is not a valid image (invalid magic bytes), skipping`);
            continue;
          }
          
          const base64 = buffer.toString('base64');
          
          // Determine correct MIME type from magic bytes
          let mimeType = 'image/jpeg';
          if (isPNG) mimeType = 'image/png';
          else if (isGIF) mimeType = 'image/gif';
          else if (isWEBP) mimeType = 'image/webp';
          
          console.log(`[script] ✓ image ${i + 1} converted to base64 (${(base64.length / 1024).toFixed(1)} KB, ${mimeType})`);
          
          contentParts.push({ 
            type: "image", 
            image: `data:${mimeType};base64,${base64}` 
          });
        } catch (error) {
          console.error(`[script] error converting image ${i + 1}:`, error);
        }
      }
      
      // Convert valid video frames to base64
      for (let i = 0; i < validFrames.length; i++) {
        try {
          const frameUrl = validFrames[i];
          console.log(`[script] downloading frame ${i + 1}/${validFrames.length}...`);
          
          const response = await fetch(frameUrl);
          if (!response.ok) {
            console.warn(`[script] failed to fetch frame ${i + 1}: ${response.statusText}`);
            continue;
          }
          
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // Validate it's actually an image by checking magic bytes
          const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
          const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
          const isGIF = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
          const isWEBP = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
          
          if (!isJPEG && !isPNG && !isGIF && !isWEBP) {
            console.warn(`[script] frame ${i + 1} is not a valid image (invalid magic bytes), skipping`);
            console.warn(`[script] first bytes: ${buffer[0]?.toString(16)} ${buffer[1]?.toString(16)} ${buffer[2]?.toString(16)} ${buffer[3]?.toString(16)}`);
            continue;
          }
          
          const base64 = buffer.toString('base64');
          
          // Determine correct MIME type from magic bytes
          let mimeType = 'image/jpeg';
          if (isPNG) mimeType = 'image/png';
          else if (isGIF) mimeType = 'image/gif';
          else if (isWEBP) mimeType = 'image/webp';
          
          console.log(`[script] ✓ frame ${i + 1} converted to base64 (${(base64.length / 1024).toFixed(1)} KB, ${mimeType})`);
          
          contentParts.push({ 
            type: "image", 
            image: `data:${mimeType};base64,${base64}` 
          });
        } catch (error) {
          console.error(`[script] error converting frame ${i + 1}:`, error);
        }
      }
      
      // Add context about videos
      if (videos.length > 0 && validFrames.length > 0) {
        contentParts.push({
          type: "text",
          text: `\n\n${videos.length} video(s) were uploaded. The frames shown represent key moments (25%, 50%, 75%) from these videos. Consider them as dynamic visual content when creating the script.`
        });
      }
      
      const imageCount = contentParts.filter(p => p.type === 'image').length;
      console.log(`[script] ✓ prepared ${imageCount} images for OpenAI (${contentParts.length} total parts)`);
      
      // If no valid images, generate script without visual context
      if (imageCount === 0) {
        console.warn("[script] no valid images found, generating script from prompt only");
        const userPromptText = prompts.scriptGeneration.user(prompt, style);
        const { text } = await generateText({
          model: openai("gpt-4o"),
          system: prompts.scriptGeneration.system(style),
          prompt: userPromptText,
        });
        
        const processedScript = text.replace(/\?/g, '???');
        console.log("[script] script generated (text-only mode)");
        return { success: true, script: processedScript };
      }

      const { text } = await generateText({
        model: openai("gpt-4o"), // Using gpt-4o for vision support
        system: prompts.scriptGeneration.system(style),
        messages: [
          {
            role: "user",
            content: contentParts as any, // Type cast needed for AI SDK compatibility
          },
        ],
      });

      // Replace single ? with ???
      const processedScript = text.replace(/\?/g, '???');

      console.log("[script] script generated with", contentParts.length, "content parts");
      return { success: true, script: processedScript };
    } catch (error) {
      console.error("[script] error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "script generation failed",
      };
    }
  },
});

export const createElevenLabsVoice = action({
  args: {
    audioUrl: v.string(),
    name: v.string(),
  },
  handler: async (ctx, { audioUrl, name }): Promise<{ success: boolean; voiceId?: string; previewStorageId?: string; error?: string }> => {
    console.log("[createVoice] creating ElevenLabs voice for:", name);
    
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        throw new Error("ELEVENLABS_API_KEY not set");
      }

      // Download the audio file from Convex storage
      console.log("[createVoice] fetching audio from:", audioUrl);
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio: ${audioResponse.statusText}`);
      }
      const audioBlob = await audioResponse.blob();
      console.log("[createVoice] audio downloaded, size:", audioBlob.size);

      // Create FormData for the multipart/form-data request
      const formData = new FormData();
      formData.append("name", name);
      formData.append("files", audioBlob, "voice_sample.webm");

      // Call ElevenLabs API to create voice
      console.log("[createVoice] calling ElevenLabs API...");
      const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[createVoice] ElevenLabs API error:", errorText);
        throw new Error(`ElevenLabs API error: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      const voiceId = result.voice_id;
      
      if (!voiceId) {
        throw new Error("No voice_id returned from ElevenLabs API");
      }

      console.log("[createVoice] voice created successfully with ID:", voiceId);
      
      // Generate and store voice preview
      let previewStorageId: string | undefined;
      try {
        console.log("[createVoice] generating voice preview...");
        const previewResult = await ctx.runAction(api.aiServices.generateAndStoreVoicePreview, {
          voiceId,
        });
        
        if (previewResult.success && previewResult.storageId) {
          previewStorageId = previewResult.storageId;
          console.log("[createVoice] preview generated and stored");
        }
      } catch (previewError) {
        console.error("[createVoice] failed to generate preview:", previewError);
        // Don't fail the entire voice creation if preview fails
      }
      
      return { success: true, voiceId, previewStorageId };
    } catch (error) {
      console.error("[createVoice] error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "voice creation failed",
      };
    }
  },
});

export const generateAndStoreVoicePreview = action({
  args: {
    voiceId: v.string(),
  },
  handler: async (ctx, { voiceId }): Promise<{ success: boolean; storageId?: string; error?: string }> => {
    console.log("[generateAndStoreVoicePreview] generating voice preview for:", voiceId);
    
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        throw new Error("ELEVENLABS_API_KEY not set");
      }

      const client = new ElevenLabsClient({
        apiKey,
      });

      // Generate a short preview with the voice
      const previewText = "Hello! This is a preview of your custom AI voice.";
      
      const audio = await client.textToSpeech.convert(voiceId, {
        text: previewText,
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128",
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 1.0,
          style: 0.0,
          useSpeakerBoost: true,
          speed: 1.2,
        },
      });

      // Convert audio stream to buffer
      const chunks: Uint8Array[] = [];
      const reader = audio.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const audioBuffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        audioBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      console.log("[generateAndStoreVoicePreview] preview generated, size:", audioBuffer.length);
      
      // Store the preview in Convex storage
      const uploadUrl = await ctx.runMutation(api.tasks.generateUploadUrl, {});
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "audio/mp3" },
        body: audioBuffer,
      });
      const { storageId } = await uploadResponse.json();
      
      console.log("[generateAndStoreVoicePreview] preview stored successfully, storageId:", storageId);
      return { success: true, storageId };
    } catch (error) {
      console.error("[generateAndStoreVoicePreview] error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "voice preview generation failed",
      };
    }
  },
});

export const previewVoice = action({
  args: {
    voiceId: v.string(),
  },
  handler: async (ctx, { voiceId }): Promise<{ success: boolean; audioBase64?: string; error?: string }> => {
    console.log("[previewVoice] generating voice preview for:", voiceId);
    
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        throw new Error("ELEVENLABS_API_KEY not set");
      }

      const client = new ElevenLabsClient({
        apiKey,
      });

      // Generate a short preview with the voice
      const previewText = "Hello! This is a preview of your custom AI voice.";
      
      const audio = await client.textToSpeech.convert(voiceId, {
        text: previewText,
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128",
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 1.0,
          style: 0.0,
          useSpeakerBoost: true,
          speed: 1.2,
        },
      });

      // Convert audio stream to buffer
      const chunks: Uint8Array[] = [];
      const reader = audio.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const audioBuffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        audioBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert to base64 for transmission
      const audioBase64 = Buffer.from(audioBuffer).toString('base64');

      console.log("[previewVoice] preview generated successfully");
      return { success: true, audioBase64 };
    } catch (error) {
      console.error("[previewVoice] error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "voice preview failed",
      };
    }
  },
});


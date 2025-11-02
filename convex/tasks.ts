import { query, mutation, action, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { prompts } from "./prompts";

const isImageUrl = (url: string): boolean => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  return imageExtensions.some(ext => url.toLowerCase().includes(ext));
};

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const createProject = mutation({
  args: {
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
  },
  handler: async (ctx, { userId, prompt, files, fileMetadata, thumbnail }) => {
    return await ctx.db.insert("projects", {
      userId,
      prompt,
      files,
      fileMetadata,
      thumbnail: thumbnail || files[0],
      createdAt: Date.now(),
      status: "processing",
    });
  },
});

export const addFilesToProject = mutation({
  args: {
    projectId: v.id("projects"),
    files: v.array(v.id("_storage")),
    fileMetadata: v.array(v.object({
      storageId: v.id("_storage"),
      filename: v.string(),
      contentType: v.string(),
      size: v.number(),
    })),
  },
  handler: async (ctx, { projectId, files, fileMetadata }) => {
    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("project not found");
    
    const updatedFiles = [...project.files, ...files];
    const updatedFileMetadata = [...(project.fileMetadata || []), ...fileMetadata];
    
    await ctx.db.patch(projectId, {
      files: updatedFiles,
      fileMetadata: updatedFileMetadata,
    });
    
    return projectId;
  },
});

export const getProjects = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // Filter by userId if provided, otherwise get all projects
    const projects = args.userId
      ? await ctx.db
          .query("projects")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .order("desc")
          .collect()
      : await ctx.db.query("projects").order("desc").collect();
    
    return await Promise.all(
      projects.map(async (project) => ({
        ...project,
        fileUrls: await Promise.all(
          project.files.map((fileId) => ctx.storage.getUrl(fileId))
        ),
        thumbnailUrl: project.thumbnail
          ? await ctx.storage.getUrl(project.thumbnail)
          : null,
      }))
    );
  },
});

export const getProject = query({
  args: {
    id: v.id("projects"),
  },
  handler: async (ctx, { id }) => {
    const project = await ctx.db.get(id);
    if (!project) return null;

    return {
      ...project,
      fileUrls: await Promise.all(
        project.files.map((fileId) => ctx.storage.getUrl(fileId))
      ),
      thumbnailUrl: project.thumbnail
        ? await ctx.storage.getUrl(project.thumbnail)
        : null,
    };
  },
});

export const completeProject = mutation({
  args: {
    id: v.id("projects"),
  },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, {
      status: "completed",
      completedAt: Date.now(),
    });
    return id;
  },
});

export const updateProjectWithReelfulData = mutation({
  args: {
    id: v.id("projects"),
    script: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    srtContent: v.optional(v.string()),
    musicUrl: v.optional(v.string()),
    videoUrls: v.optional(v.array(v.string())),
    error: v.optional(v.string()),
    status: v.union(v.literal("completed"), v.literal("failed"), v.literal("processing")),
  },
  handler: async (
    ctx,
    { id, script, audioUrl, srtContent, musicUrl, videoUrls, error, status }
  ) => {
    const updateData: {
      status: "completed" | "failed" | "processing";
      completedAt?: number;
      script?: string;
      audioUrl?: string;
      srtContent?: string;
      musicUrl?: string;
      videoUrls?: string[];
      error?: string;
    } = {
      status,
      script,
      audioUrl,
      srtContent,
      musicUrl,
      videoUrls,
      error,
    };

    if (status === "completed" || status === "failed") {
      updateData.completedAt = Date.now();
    }

    await ctx.db.patch(id, updateData);

    return id;
  },
});

export const deleteProject = mutation({
  args: {
    id: v.id("projects"),
  },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return id;
  },
});

export const updateProjectStatus = mutation({
  args: {
    id: v.id("projects"),
    status: v.union(
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("rendering")
    ),
  },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, { status });
    return id;
  },
});

export const updateProjectScript = mutation({
  args: {
    id: v.id("projects"),
    script: v.string(),
  },
  handler: async (ctx, { id, script }) => {
    await ctx.db.patch(id, { script });
    return { id, script };
  },
});

export const markProjectSubmitted = mutation({
  args: {
    id: v.id("projects"),
  },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { submittedAt: Date.now() });
    return { id };
  },
});

export const updateProjectWithRenderResult = mutation({
  args: {
    id: v.id("projects"),
    renderedVideoUrl: v.optional(v.string()),
    error: v.optional(v.string()),
    status: v.union(v.literal("completed"), v.literal("failed")),
  },
  handler: async (ctx, { id, renderedVideoUrl, error, status }) => {
    await ctx.db.patch(id, {
      status,
      renderedVideoUrl,
      error,
      completedAt: Date.now(),
      renderProgress: undefined,
    });
    return id;
  },
});

export const updateRenderProgress = mutation({
  args: {
    id: v.id("projects"),
    step: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, { id, step, details }) => {
    await ctx.db.patch(id, {
      renderProgress: {
        step,
        details,
        timestamp: Date.now(),
      },
    });
    return id;
  },
});

export const updateProjectSandbox = mutation({
  args: {
    id: v.id("projects"),
    sandboxId: v.string(),
  },
  handler: async (ctx, { id, sandboxId }) => {
    await ctx.db.patch(id, { sandboxId });
    return id;
  },
});

export const simulateCompleted = mutation({
  args: {
    id: v.id("projects"),
  },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, {
      status: "completed",
      completedAt: Date.now(),
      script:
        "this is a simulated script. ever wonder how top businesses save 10 hours a week? meet our product, the game-changing automation platform that helps you work smarter, not harder. join thousands of happy users today!",
      audioUrl: "https://example.com/audio.mp3",
      musicUrl: "https://example.com/music.mp3",
      videoUrls: [],
    });
    return id;
  },
});

export const processProjectWithReelful = action({
  args: {
    projectId: v.id("projects"),
    reelfulApiUrl: v.string(),
  },
  handler: async (ctx, { projectId, reelfulApiUrl }) => {
    const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
    if (!project) {
      throw new Error("project not found");
    }

    const imageUrls = await Promise.all(
      project.files.map(async (fileId: Id<"_storage">) => {
        const url = await ctx.storage.getUrl(fileId);
        return url;
      })
    );

    const validImageUrls = imageUrls.filter(
      (url: string | null): url is string => url !== null
    );

    try {
      const response = await fetch(`${reelfulApiUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: project.prompt,
          model: "openai/gpt-5",
          image_urls: validImageUrls,
        }),
      });

      if (!response.ok) {
        throw new Error(`reelful api error: ${response.statusText}`);
      }

      const data = await response.json();

      const audioUrl = data.audio_path
        ? `${reelfulApiUrl}${data.audio_path}`
        : undefined;
      const musicUrl = data.music_path
        ? `${reelfulApiUrl}${data.music_path}`
        : undefined;
      const videoUrls = data.video_paths?.map(
        (path: string) => `${reelfulApiUrl}${path}`
      );

      await ctx.runMutation(api.tasks.updateProjectWithReelfulData, {
        id: projectId,
        script: data.script || undefined,
        audioUrl,
        musicUrl,
        videoUrls,
        error: data.error ? data.error : undefined,
        status: data.error ? "failed" : "completed",
      });

      return { success: true };
    } catch (error) {
      await ctx.runMutation(api.tasks.updateProjectWithReelfulData, {
        id: projectId,
        error: error instanceof Error ? error.message : "unknown error",
        status: "failed",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "unknown error",
      };
    }
  },
});

export const generateScriptOnly = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }): Promise<{ success: boolean; script?: string; error?: string }> => {
    console.log("[generate-script] starting script generation for project:", projectId);

    try {
      const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
      if (!project) {
        throw new Error("project not found");
      }

      // Get user's preferred style
      let style = "professional"; // default
      if (project.userId) {
        const user = await ctx.runQuery(api.users.getCurrentUser, { userId: project.userId });
        if (user?.preferredStyle) {
          style = user.preferredStyle;
          console.log("[generate-script] using user's preferred style:", style);
        }
      }

      console.log("[generate-script] generating script from prompt and images");
      const fileUrls = project.fileUrls?.filter((url: string | null): url is string => url !== null) || [];
      const scriptResult = await ctx.runAction(api.aiServices.generateScript, {
        prompt: project.prompt,
        imageUrls: fileUrls,
        style,
      });

      if (!scriptResult.success) {
        throw new Error(`script generation failed: ${scriptResult.error}`);
      }

      const script: string = scriptResult.script!;
      console.log("[generate-script] script generated successfully");

      // Save script to project with status "completed" (script ready for review)
      await ctx.runMutation(api.tasks.updateProjectWithReelfulData, {
        id: projectId,
        script,
        status: "completed",
      });

      console.log("[generate-script] script saved to project");
      return { success: true, script };
    } catch (error) {
      console.error("[generate-script] error:", error instanceof Error ? error.message : "unknown error");
      await ctx.runMutation(api.tasks.updateProjectWithReelfulData, {
        id: projectId,
        error: error instanceof Error ? error.message : "script generation failed",
        status: "failed",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "script generation failed",
      };
    }
  },
});

export const generateMediaAssets = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }): Promise<{ success: boolean; error?: string }> => {
    console.log("[generate-media] starting media generation for project:", projectId);

    let audioUrl: string | null | undefined;
    let srtContent: string | undefined;
    let musicUrl: string | null | undefined;
    const videoUrls: string[] = [];

    try {
      const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
      if (!project) {
        throw new Error("project not found");
      }

      if (!project.script) {
        throw new Error("no script found - generate or provide script first");
      }

      // Set status to processing
      await ctx.runMutation(api.tasks.updateProjectStatus, {
        id: projectId,
        status: "processing",
      });

      console.log("[generate-media] step 1: generating voiceover");
      // Get user's custom voice ID and preferred style if available
      let voiceId: string | undefined;
      let style = "professional"; // default
      if (project.userId) {
        const user = await ctx.runQuery(api.users.getCurrentUser, { userId: project.userId });
        // Use selected voice if available, otherwise fall back to custom voice
        if (user?.selectedVoiceId) {
          voiceId = user.selectedVoiceId;
          console.log("[generate-media] using user's selected voice ID:", voiceId);
        } else if (user?.elevenlabsVoiceId) {
          voiceId = user.elevenlabsVoiceId;
          console.log("[generate-media] using user's custom voice ID:", voiceId);
        }
        // Get user's preferred style
        if (user?.preferredStyle) {
          style = user.preferredStyle;
          console.log("[generate-media] using user's preferred style:", style);
        }
      }
      
      const voiceoverResult = await ctx.runAction(api.aiServices.generateVoiceover, {
        text: project.script,
        voiceId,
      });

      if (!voiceoverResult.success || !voiceoverResult.audioUrl) {
        throw new Error(`voiceover generation failed: ${voiceoverResult.error}`);
      }

      audioUrl = voiceoverResult.audioUrl;
      srtContent = voiceoverResult.srtContent;
      const voiceoverDuration = voiceoverResult.durationMs || 15000;
      console.log("[generate-media] voiceover uploaded:", audioUrl, "duration:", voiceoverDuration, "ms");
      if (srtContent) {
        console.log("[generate-media] SRT generated, length:", srtContent.length, "chars");
      }

      console.log("[generate-media] step 2: generating background music");
      const adjustedMusicDuration = Math.floor(voiceoverDuration / 1.25);
      console.log("[generate-media] music duration (voiceover / 1.25):", adjustedMusicDuration, "ms");
      
      const musicResult = await ctx.runAction(api.aiServices.generateMusic, {
        prompt: prompts.musicGeneration.prompt(style),
        durationMs: adjustedMusicDuration,
      });

      musicUrl = musicResult.success ? musicResult.musicUrl : undefined;
      if (musicUrl) {
        console.log("[generate-media] music uploaded:", musicUrl);
      }

      console.log("[generate-media] step 3: animating images");
      const fileUrls = project.fileUrls?.filter((url: string | null): url is string => url !== null) || [];
      console.log("[generate-media] Total file URLs:", fileUrls.length);
      
      // Filter images using fileMetadata contentType instead of URL extensions
      const imageOnlyUrls: string[] = [];
      if (project.fileMetadata && project.fileMetadata.length > 0) {
        console.log("[generate-media] Using fileMetadata to identify images");
        for (let i = 0; i < project.fileMetadata.length; i++) {
          const meta = project.fileMetadata[i];
          console.log(`[generate-media] File ${i + 1}: ${meta.filename}, type: ${meta.contentType}`);
          
          if (meta.contentType.startsWith('image/')) {
            const url = fileUrls[i];
            if (url) {
              imageOnlyUrls.push(url);
              console.log(`[generate-media] ✓ Found image: ${meta.filename} (${meta.contentType})`);
            }
          }
        }
      } else {
        // Fallback to old method if no metadata
        console.log("[generate-media] No fileMetadata, falling back to URL extension check");
        imageOnlyUrls.push(...fileUrls.filter((url: string) => isImageUrl(url)));
      }
      
      console.log("[generate-media] Image URLs found:", imageOnlyUrls.length);
      console.log("[generate-media] Will animate ALL images:", imageOnlyUrls.length);
      
      if (imageOnlyUrls.length === 0) {
        console.log("[generate-media] ⚠️ No images to animate! Skipping animation step.");
      }
      
      for (let i = 0; i < imageOnlyUrls.length; i++) {
        console.log(`[generate-media] ========================================`);
        console.log(`[generate-media] Processing image ${i + 1}/${imageOnlyUrls.length}`);
        console.log(`[generate-media] Image URL:`, imageOnlyUrls[i].substring(0, 80));
        console.log(`[generate-media] ========================================`);
        
        try {
          console.log(`[generate-media] Calling animateImage action...`);
          const animateResult = await ctx.runAction(api.aiServices.animateImage, {
            imageUrl: imageOnlyUrls[i],
          });

          console.log(`[generate-media] Animation result for image ${i + 1}:`, {
            success: animateResult.success,
            hasData: !!animateResult.data,
            dataType: animateResult.data ? typeof animateResult.data : 'null',
            error: animateResult.error,
            requestId: (animateResult as any).requestId,
          });

          if (animateResult.data) {
            console.log(`[generate-media] Result data structure:`, JSON.stringify(animateResult.data, null, 2));
          }

          if (animateResult.success && animateResult.data) {
            const data = animateResult.data as any;
            console.log(`[generate-media] Checking for video URL in result...`);
            console.log(`[generate-media] data.video exists:`, !!data.video);
            console.log(`[generate-media] data.video?.url exists:`, !!data.video?.url);
            
            const videoUrl = data.video?.url;
            if (videoUrl) {
              videoUrls.push(videoUrl);
              console.log(`[generate-media] ✅ Animated image ${i + 1} SUCCESS`);
              console.log(`[generate-media] Video URL:`, videoUrl);
              console.log(`[generate-media] Total videos so far:`, videoUrls.length);
              
              console.log(`[generate-media] Updating project with new video...`);
              await ctx.runMutation(api.tasks.updateProjectWithReelfulData, {
                id: projectId,
                script: project.script,
                audioUrl: audioUrl || undefined,
                srtContent: srtContent || undefined,
                musicUrl: musicUrl || undefined,
                videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
                status: "processing",
              });
              console.log(`[generate-media] ✓ Project updated with ${videoUrls.length} videos`);
            } else {
              console.error(`[generate-media] ❌ Image ${i + 1} animation succeeded but no video URL in result!`);
              console.error(`[generate-media] Full result data:`, JSON.stringify(animateResult.data, null, 2));
            }
          } else {
            console.error(`[generate-media] ❌ Image ${i + 1} animation failed`);
            console.error(`[generate-media] Error:`, animateResult.error);
            console.error(`[generate-media] Full result:`, JSON.stringify(animateResult, null, 2));
          }
        } catch (error) {
          console.error(`[generate-media] ❌ Exception animating image ${i + 1}`);
          console.error(`[generate-media] Exception type:`, error?.constructor?.name);
          console.error(`[generate-media] Exception message:`, error instanceof Error ? error.message : String(error));
          console.error(`[generate-media] Full exception:`, error);
        }
      }

      await ctx.runMutation(api.tasks.updateProjectWithReelfulData, {
        id: projectId,
        script: project.script,
        audioUrl: audioUrl || undefined,
        srtContent: srtContent || undefined,
        musicUrl: musicUrl || undefined,
        videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
        status: "completed",
      });

      console.log("[generate-media] media generation complete");
      console.log("[generate-media] Final state:");
      console.log("[generate-media]   - audioUrl:", audioUrl ? "✓ " + audioUrl.substring(0, 50) : "✗");
      console.log("[generate-media]   - musicUrl:", musicUrl ? "✓ " + musicUrl.substring(0, 50) : "✗");
      console.log("[generate-media]   - videoUrls:", videoUrls.length, "videos");
      console.log("[generate-media]   - status: completed");
      return { success: true };
    } catch (error) {
      console.error("[generate-media] error:", error instanceof Error ? error.message : "unknown error");
      await ctx.runMutation(api.tasks.updateProjectWithReelfulData, {
        id: projectId,
        error: error instanceof Error ? error.message : "media generation failed",
        status: "failed",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "media generation failed",
      };
    }
  },
});

export const processProjectWithAI = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    console.log("[ai-process] starting ai processing for project:", projectId);

    let script: string | undefined;
    let audioUrl: string | null | undefined;
    let srtContent: string | undefined;
    let musicUrl: string | null | undefined;
    const videoUrls: string[] = [];

    try {
      const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
      if (!project) {
        throw new Error("project not found");
      }

      // Get user's preferred style
      let style = "professional"; // default
      if (project.userId) {
        const user = await ctx.runQuery(api.users.getCurrentUser, { userId: project.userId });
        if (user?.preferredStyle) {
          style = user.preferredStyle;
          console.log("[ai-process] using user's preferred style:", style);
        }
      }

      console.log("[ai-process] step 1: generating script");
      const fileUrls = project.fileUrls?.filter((url: string | null): url is string => url !== null) || [];
      const scriptResult = await ctx.runAction(api.aiServices.generateScript, {
        prompt: project.prompt,
        imageUrls: fileUrls,
        style,
      });

      if (!scriptResult.success) {
        throw new Error(`script generation failed: ${scriptResult.error}`);
      }

      script = scriptResult.script!;
      console.log("[ai-process] script generated:", script);

      console.log("[ai-process] step 2: generating voiceover");
      // Get user's custom voice ID if available
      let voiceId: string | undefined;
      if (project.userId) {
        const user = await ctx.runQuery(api.users.getCurrentUser, { userId: project.userId });
        // Use selected voice if available, otherwise fall back to custom voice
        if (user?.selectedVoiceId) {
          voiceId = user.selectedVoiceId;
          console.log("[ai-process] using user's selected voice ID:", voiceId);
        } else if (user?.elevenlabsVoiceId) {
          voiceId = user.elevenlabsVoiceId;
          console.log("[ai-process] using user's custom voice ID:", voiceId);
        }
      }
      
      const voiceoverResult = await ctx.runAction(api.aiServices.generateVoiceover, {
        text: script,
        voiceId,
      });

      if (!voiceoverResult.success || !voiceoverResult.audioUrl) {
        throw new Error(`voiceover generation failed: ${voiceoverResult.error}`);
      }

      audioUrl = voiceoverResult.audioUrl;
      srtContent = voiceoverResult.srtContent;
      const voiceoverDuration = voiceoverResult.durationMs || 15000;
      console.log("[ai-process] voiceover uploaded:", audioUrl, "duration:", voiceoverDuration, "ms");
      if (srtContent) {
        console.log("[ai-process] SRT generated, length:", srtContent.length, "chars");
      }

      console.log("[ai-process] step 3: generating background music");
      const adjustedMusicDuration = Math.floor(voiceoverDuration / 1.25);
      console.log("[ai-process] music duration (voiceover / 1.25):", adjustedMusicDuration, "ms");
      
      const musicResult = await ctx.runAction(api.aiServices.generateMusic, {
        prompt: prompts.musicGeneration.prompt(style),
        durationMs: adjustedMusicDuration,
      });

      musicUrl = musicResult.success ? musicResult.musicUrl : undefined;
      if (musicUrl) {
        console.log("[ai-process] music uploaded:", musicUrl);
      }

      console.log("[ai-process] step 4: animating images");
      
      // Filter images using fileMetadata contentType instead of URL extensions
      const imageOnlyUrls: string[] = [];
      if (project.fileMetadata && project.fileMetadata.length > 0) {
        console.log("[ai-process] Using fileMetadata to identify images");
        for (let i = 0; i < project.fileMetadata.length; i++) {
          const meta = project.fileMetadata[i];
          console.log(`[ai-process] File ${i + 1}: ${meta.filename}, type: ${meta.contentType}`);
          
          if (meta.contentType.startsWith('image/')) {
            const url = fileUrls[i];
            if (url) {
              imageOnlyUrls.push(url);
              console.log(`[ai-process] ✓ Found image: ${meta.filename} (${meta.contentType})`);
            }
          }
        }
      } else {
        // Fallback to old method if no metadata
        console.log("[ai-process] No fileMetadata, falling back to URL extension check");
        imageOnlyUrls.push(...fileUrls.filter((url: string) => isImageUrl(url)));
      }
      
      console.log("[ai-process] Will animate ALL images:", imageOnlyUrls.length);
      
      for (let i = 0; i < imageOnlyUrls.length; i++) {
        console.log(`[ai-process] ========================================`);
        console.log(`[ai-process] Animating image ${i + 1}/${imageOnlyUrls.length}`);
        console.log(`[ai-process] Image URL:`, imageOnlyUrls[i].substring(0, 80));
        
        try {
          const animateResult = await ctx.runAction(api.aiServices.animateImage, {
            imageUrl: imageOnlyUrls[i],
          });

          console.log(`[ai-process] Animation result:`, {
            success: animateResult.success,
            hasData: !!animateResult.data,
            error: animateResult.error,
          });

          if (animateResult.success && animateResult.data) {
            const videoUrl = (animateResult.data as any).video?.url;
            if (videoUrl) {
              videoUrls.push(videoUrl);
              console.log(`[ai-process] ✅ Animated image ${i + 1}, video URL:`, videoUrl);
              console.log(`[ai-process] Total videos: ${videoUrls.length}`);
              
              await ctx.runMutation(api.tasks.updateProjectWithReelfulData, {
                id: projectId,
                script,
                audioUrl: audioUrl || undefined,
                srtContent: srtContent || undefined,
                musicUrl: musicUrl || undefined,
                videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
                status: "processing",
              });
              console.log(`[ai-process] ✓ Project updated`);
            } else {
              console.error(`[ai-process] ❌ No video URL in animation result`);
            }
          } else {
            console.error(`[ai-process] ❌ Animation failed:`, animateResult.error);
          }
        } catch (error) {
          console.error(`[ai-process] ❌ Exception:`, error instanceof Error ? error.message : String(error));
        }
      }

      await ctx.runMutation(api.tasks.updateProjectWithReelfulData, {
        id: projectId,
        script,
        audioUrl: audioUrl || undefined,
        srtContent: srtContent || undefined,
        musicUrl: musicUrl || undefined,
        videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
        status: "completed",
      });

      console.log("[ai-process] ai processing complete");
      return { success: true };
    } catch (error) {
      console.error("[ai-process] error:", error instanceof Error ? error.message : "unknown error");
      await ctx.runMutation(api.tasks.updateProjectWithReelfulData, {
        id: projectId,
        script: script || undefined,
        audioUrl: audioUrl || undefined,
        srtContent: undefined,
        musicUrl: musicUrl || undefined,
        videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
        error: error instanceof Error ? error.message : "ai processing failed",
        status: "failed",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "ai processing failed",
      };
    }
  },
});

export const regenerateScript = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }): Promise<{ success: boolean; script?: string; error?: string }> => {
    console.log("[regenerate-script] regenerating script for project:", projectId);

    try {
      const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
      if (!project) {
        throw new Error("project not found");
      }

      // Get user's preferred style
      let style = "professional"; // default
      if (project.userId) {
        const user = await ctx.runQuery(api.users.getCurrentUser, { userId: project.userId });
        if (user?.preferredStyle) {
          style = user.preferredStyle;
          console.log("[regenerate-script] using user's preferred style:", style);
        }
      }

      const imageUrls = project.fileUrls?.filter((url: string | null): url is string => url !== null) || [];
      const scriptResult = await ctx.runAction(api.aiServices.generateScript, {
        prompt: project.prompt,
        imageUrls,
        style,
      });

      if (!scriptResult.success) {
        throw new Error(`script generation failed: ${scriptResult.error}`);
      }

      await ctx.runMutation(api.tasks.updateProjectWithReelfulData, {
        id: projectId,
        script: scriptResult.script,
        audioUrl: project.audioUrl,
        srtContent: project.srtContent,
        musicUrl: project.musicUrl,
        videoUrls: project.videoUrls,
        status: "completed",
      });

      console.log("[regenerate-script] script regenerated");
      return { success: true, script: scriptResult.script };
    } catch (error) {
      console.error("[regenerate-script] error:", error instanceof Error ? error.message : "unknown error");
      return {
        success: false,
        error: error instanceof Error ? error.message : "script regeneration failed",
      };
    }
  },
});

export const regenerateVoiceover = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }): Promise<{ success: boolean; audioUrl?: string | null; error?: string }> => {
    console.log("[regenerate-voiceover] regenerating voiceover for project:", projectId);

    try {
      const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
      if (!project) {
        throw new Error("project not found");
      }

      if (!project.script) {
        throw new Error("no script found - generate script first");
      }

      // Get user's selected voice ID if available
      let voiceId: string | undefined;
      if (project.userId) {
        const user = await ctx.runQuery(api.users.getCurrentUser, { userId: project.userId });
        // Use selected voice if available, otherwise fall back to custom voice
        if (user?.selectedVoiceId) {
          voiceId = user.selectedVoiceId;
          console.log("[regenerate-voiceover] using user's selected voice ID:", voiceId);
        } else if (user?.elevenlabsVoiceId) {
          voiceId = user.elevenlabsVoiceId;
          console.log("[regenerate-voiceover] using user's custom voice ID:", voiceId);
        }
      }

      const voiceoverResult = await ctx.runAction(api.aiServices.generateVoiceover, {
        text: project.script,
        voiceId,
      });

      if (!voiceoverResult.success || !voiceoverResult.audioUrl) {
        throw new Error(`voiceover generation failed: ${voiceoverResult.error}`);
      }

      const audioUrl = voiceoverResult.audioUrl;
      const srtContent = voiceoverResult.srtContent;
      console.log("[regenerate-voiceover] voiceover uploaded:", audioUrl);
      if (srtContent) {
        console.log("[regenerate-voiceover] SRT length:", srtContent.length, "chars");
      }

      await ctx.runMutation(api.tasks.updateProjectWithReelfulData, {
        id: projectId,
        script: project.script,
        audioUrl: audioUrl || undefined,
        srtContent: srtContent || undefined,
        musicUrl: project.musicUrl,
        videoUrls: project.videoUrls,
        status: "completed",
      });

      console.log("[regenerate-voiceover] voiceover regenerated");
      return { success: true, audioUrl };
    } catch (error) {
      console.error("[regenerate-voiceover] error:", error instanceof Error ? error.message : "unknown error");
      return {
        success: false,
        error: error instanceof Error ? error.message : "voiceover regeneration failed",
      };
    }
  },
});

export const addAnimatedVideo = action({
  args: {
    projectId: v.id("projects"),
    videoUrl: v.string(),
  },
  handler: async (ctx, { projectId, videoUrl }) => {
    const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
    if (!project) throw new Error("project not found");

    const currentVideoUrls = project.videoUrls || [];
    const updatedVideoUrls = [...currentVideoUrls, videoUrl];

    await ctx.runMutation(api.tasks.updateProjectWithReelfulData, {
      id: projectId,
      script: project.script,
      audioUrl: project.audioUrl,
      srtContent: project.srtContent,
      musicUrl: project.musicUrl,
      videoUrls: updatedVideoUrls,
      status: project.status === "rendering" ? "completed" : (project.status || "completed"),
    });

    return { success: true };
  },
});

export const regenerateAnimations = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }): Promise<{ success: boolean; videoUrls?: string[]; error?: string }> => {
    console.log("[regenerate-animations] regenerating animations for project:", projectId);

    try {
      const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
      if (!project) {
        throw new Error("project not found");
      }

      const fileUrls = project.fileUrls?.filter((url: string | null): url is string => url !== null) || [];
      
      // Filter images using fileMetadata contentType instead of URL extensions
      const imageUrls: string[] = [];
      if (project.fileMetadata && project.fileMetadata.length > 0) {
        console.log("[regenerate-animations] Using fileMetadata to identify images");
        for (let i = 0; i < project.fileMetadata.length; i++) {
          const meta = project.fileMetadata[i];
          console.log(`[regenerate-animations] File ${i + 1}: ${meta.filename}, type: ${meta.contentType}`);
          
          if (meta.contentType.startsWith('image/')) {
            const url = fileUrls[i];
            if (url) {
              imageUrls.push(url);
              console.log(`[regenerate-animations] ✓ Found image: ${meta.filename} (${meta.contentType})`);
            }
          }
        }
      } else {
        // Fallback to old method if no metadata
        console.log("[regenerate-animations] No fileMetadata, falling back to URL extension check");
        imageUrls.push(...fileUrls.filter((url: string) => isImageUrl(url)));
      }
      
      if (imageUrls.length === 0) {
        throw new Error("no images found");
      }

      console.log("[regenerate-animations] Will animate ALL images:", imageUrls.length);
      const videoUrls: string[] = [];
      
      for (let i = 0; i < imageUrls.length; i++) {
        console.log(`[regenerate-animations] ========================================`);
        console.log(`[regenerate-animations] Animating image ${i + 1}/${imageUrls.length}`);
        console.log(`[regenerate-animations] Image URL:`, imageUrls[i].substring(0, 80));
        
        try {
          const animateResult = await ctx.runAction(api.aiServices.animateImage, {
            imageUrl: imageUrls[i],
          });

          console.log(`[regenerate-animations] Result:`, {
            success: animateResult.success,
            hasData: !!animateResult.data,
            error: animateResult.error,
          });

          if (animateResult.success && animateResult.data) {
            const videoUrl = (animateResult.data as any).video?.url;
            if (videoUrl) {
              videoUrls.push(videoUrl);
              console.log(`[regenerate-animations] ✅ Animated image ${i + 1}, URL:`, videoUrl);
              console.log(`[regenerate-animations] Total videos: ${videoUrls.length}`);
            } else {
              console.error(`[regenerate-animations] ❌ No video URL in result`);
            }
          } else {
            console.error(`[regenerate-animations] ❌ Animation failed:`, animateResult.error);
          }
        } catch (error) {
          console.error(`[regenerate-animations] ❌ Exception:`, error instanceof Error ? error.message : String(error));
        }
      }

      await ctx.runMutation(api.tasks.updateProjectWithReelfulData, {
        id: projectId,
        script: project.script,
        audioUrl: project.audioUrl,
        srtContent: project.srtContent,
        musicUrl: project.musicUrl,
        videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
        status: "completed",
      });

      console.log("[regenerate-animations] animations regenerated");
      return { success: true, videoUrls };
    } catch (error) {
      console.error("[regenerate-animations] error:", error instanceof Error ? error.message : "unknown error");
      
      const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
      if (project) {
        await ctx.runMutation(api.tasks.updateProjectWithReelfulData, {
          id: projectId,
          script: project.script,
          audioUrl: project.audioUrl,
        srtContent: project.srtContent,
          musicUrl: project.musicUrl,
          videoUrls: project.videoUrls,
          status: "completed",
        });
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "animations regeneration failed",
      };
    }
  },
});

export const regenerateMusic = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }): Promise<{ success: boolean; musicUrl?: string | null; error?: string }> => {
    console.log("[regenerate-music] regenerating music for project:", projectId);

    try {
      const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
      if (!project) {
        throw new Error("project not found");
      }

      // Get user's preferred style
      let style = "professional"; // default
      if (project.userId) {
        const user = await ctx.runQuery(api.users.getCurrentUser, { userId: project.userId });
        if (user?.preferredStyle) {
          style = user.preferredStyle;
          console.log("[regenerate-music] using user's preferred style:", style);
        }
      }

      const musicResult = await ctx.runAction(api.aiServices.generateMusic, {
        prompt: prompts.musicGeneration.prompt(style),
        durationMs: 15000,
      });

      if (!musicResult.success || !musicResult.musicUrl) {
        throw new Error(`music generation failed: ${musicResult.error}`);
      }

      const musicUrl = musicResult.musicUrl;
      console.log("[regenerate-music] music uploaded:", musicUrl);

      await ctx.runMutation(api.tasks.updateProjectWithReelfulData, {
        id: projectId,
        script: project.script,
        audioUrl: project.audioUrl,
        srtContent: project.srtContent,
        musicUrl: musicUrl || undefined,
        videoUrls: project.videoUrls,
        status: "completed",
      });

      console.log("[regenerate-music] music regenerated");
      return { success: true, musicUrl };
    } catch (error) {
      console.error("[regenerate-music] error:", error instanceof Error ? error.message : "unknown error");
      return {
        success: false,
        error: error instanceof Error ? error.message : "music regeneration failed",
      };
    }
  },
});

export const updateRenderStep = mutation({
  args: {
    id: v.id("projects"),
    step: v.union(
      v.literal("not_started"),
      v.literal("creating_sandbox"),
      v.literal("uploading_media"),
      v.literal("editing_sequence"),
      v.literal("rendering_video"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { id, step, error }) => {
    await ctx.db.patch(id, { 
      renderStep: step,
      renderError: error,
    });
  },
});

export const updateSandboxStatus = mutation({
  args: {
    id: v.id("projects"),
    status: v.union(v.literal("alive"), v.literal("dead")),
  },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, { sandboxStatus: status });
  },
});

export const animateSingleImage = action({
  args: {
    imageUrl: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, { imageUrl, projectId }): Promise<{ success: boolean; videoUrl?: string; error?: string }> => {
    console.log("[animate-single] animating image:", imageUrl);
    
    try {
      const animateResult = await ctx.runAction(api.aiServices.animateImage, {
        imageUrl,
      });

      if (animateResult.success && animateResult.data) {
        const videoUrl = (animateResult.data).video?.url;
        if (videoUrl) {
          const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
          const existingVideos = project?.videoUrls || [];
          
          await ctx.runMutation(api.tasks.updateProjectWithReelfulData, {
            status: "processing",
            id: projectId,
            videoUrls: [...existingVideos, videoUrl],
          });
          
          console.log("[animate-single] animation added to project");
          return { success: true, videoUrl };
        }
      }

      throw new Error(animateResult.error || "animation failed");
    } catch (error) {
      console.error("[animate-single] error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "animation failed",
      };
    }
  },
});

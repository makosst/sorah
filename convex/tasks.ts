import { query, mutation, action, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

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

      console.log("[ai-process] step 1: generating script");
      const fileUrls = project.fileUrls?.filter((url: string | null): url is string => url !== null) || [];
      const scriptResult = await ctx.runAction(api.aiServices.generateScript, {
        prompt: project.prompt,
        imageUrls: fileUrls,
      });

      if (!scriptResult.success) {
        throw new Error(`script generation failed: ${scriptResult.error}`);
      }

      script = scriptResult.script!;
      console.log("[ai-process] script generated:", script);

      console.log("[ai-process] step 2: generating voiceover");
      const voiceoverResult = await ctx.runAction(api.aiServices.generateVoiceover, {
        text: script,
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
        prompt: "upbeat background music for social media video",
        durationMs: adjustedMusicDuration,
      });

      musicUrl = musicResult.success ? musicResult.musicUrl : undefined;
      if (musicUrl) {
        console.log("[ai-process] music uploaded:", musicUrl);
      }

      console.log("[ai-process] step 4: animating images");
      const imageOnlyUrls = fileUrls.filter((url: string) => isImageUrl(url));
      for (let i = 0; i < Math.min(imageOnlyUrls.length, 3); i++) {
        console.log(`[ai-process] animating image ${i + 1}/${imageOnlyUrls.length}`);
        const animateResult = await ctx.runAction(api.aiServices.animateImage, {
          imageUrl: imageOnlyUrls[i],
        });

        if (animateResult.success && animateResult.data) {
          const videoUrl = (animateResult.data).video?.url;
          if (videoUrl) {
            videoUrls.push(videoUrl);
            console.log(`[ai-process] animated image ${i + 1}, saving progress...`);
            
            await ctx.runMutation(api.tasks.updateProjectWithReelfulData, {
              id: projectId,
              script,
              audioUrl: audioUrl || undefined,
              srtContent: srtContent || undefined,
              musicUrl: musicUrl || undefined,
              videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
              status: "processing",
            });
          }
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

      const imageUrls = project.fileUrls?.filter((url: string | null): url is string => url !== null) || [];
      const scriptResult = await ctx.runAction(api.aiServices.generateScript, {
        prompt: project.prompt,
        imageUrls,
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

      const voiceoverResult = await ctx.runAction(api.aiServices.generateVoiceover, {
        text: project.script,
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

      const imageUrls = project.fileUrls?.filter((url: string | null): url is string => url !== null && isImageUrl(url)) || [];
      if (imageUrls.length === 0) {
        throw new Error("no images found");
      }

      const videoUrls: string[] = [];
      for (let i = 0; i < Math.min(imageUrls.length, 3); i++) {
        console.log(`[regenerate-animations] animating image ${i + 1}/${imageUrls.length}`);
        const animateResult = await ctx.runAction(api.aiServices.animateImage, {
          imageUrl: imageUrls[i],
        });

        if (animateResult.success && animateResult.data) {
          const videoUrl = (animateResult.data).video?.url;
          if (videoUrl) {
            videoUrls.push(videoUrl);
            console.log(`[regenerate-animations] animated image ${i + 1}`);
          }
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

      const musicResult = await ctx.runAction(api.aiServices.generateMusic, {
        prompt: "upbeat background music for social media video",
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

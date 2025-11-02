"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { Sandbox } from "e2b";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { prompts } from "./prompts";

// Helper function to sanitize filenames
function sanitizeFilename(filename: string): string {
  // Get file extension
  const lastDotIndex = filename.lastIndexOf('.');
  const name = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  const ext = lastDotIndex > 0 ? filename.substring(lastDotIndex) : '';
  
  // Replace spaces with underscores, remove special characters except dots, dashes, and underscores
  const sanitizedName = name
    .replace(/\s+/g, '_')  // Replace spaces with underscores
    .replace(/[^a-zA-Z0-9._-]/g, '');  // Remove special characters
  
  // Ensure the filename isn't empty
  const finalName = sanitizedName || 'file';
  
  return finalName + ext;
}

export const renderVideo = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    console.log("[render] starting render for project:", projectId);
    
    await ctx.runMutation(api.tasks.updateProjectStatus, {
      id: projectId,
      status: "rendering",
    });
    console.log("[render] status updated to rendering");

    try {
      const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
      if (!project) {
        throw new Error("project not found");
      }
      console.log("[render] project loaded, has audio:", !!project.audioUrl, "music:", !!project.musicUrl, "videos:", project.videoUrls?.length || 0);

      if (!process.env.E2B_API_KEY) {
        throw new Error("E2B_API_KEY not set in convex environment variables");
      }
      
      const claudeToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
      if (!claudeToken) {
        throw new Error("CLAUDE_CODE_OAUTH_TOKEN not set in convex environment variables");
      }

      let sandbox;
      if (project.sandboxId) {
        console.log("[render] connecting to existing sandbox:", project.sandboxId);
        await ctx.runMutation(api.tasks.updateRenderProgress, {
          id: projectId,
          step: "connecting to sandbox",
          details: "reusing existing e2b environment",
        });
        
        try {
          sandbox = await Sandbox.connect(project.sandboxId, {
            timeoutMs: 3600000,
          });
          console.log("[render] connected to existing sandbox, waking it up...");
          await sandbox.commands.run("echo 'sandbox alive'");
          console.log("[render] sandbox is awake");
        } catch (error) {
          console.log("[render] failed to connect to existing sandbox, creating new one:", error);

          sandbox = await Sandbox.betaCreate("8r14p0kvwebvpgno5hia", {
            autoPause: true,
            timeoutMs: 3600000,
            envs: {
              CLAUDE_CODE_OAUTH_TOKEN: claudeToken,
            },
          });

          sandbox.setTimeout(3600000);

          console.log("[render] new sandbox created:", sandbox.sandboxId);
          
          await ctx.runMutation(api.tasks.updateProjectSandbox, {
            id: projectId,
            sandboxId: sandbox.sandboxId,
          });
        }
      } else {
        console.log("[render] creating new e2b sandbox...");
        await ctx.runMutation(api.tasks.updateRenderProgress, {
          id: projectId,
          step: "creating sandbox",
          details: "initializing e2b environment with remotion template",
        });
        
        sandbox = await Sandbox.betaCreate("8r14p0kvwebvpgno5hia", {
          autoPause: true,
          timeoutMs: 3600000,
          envs: {
            CLAUDE_CODE_OAUTH_TOKEN: claudeToken,
          },
        });

        sandbox.setTimeout(3600000);

        console.log("[render] sandbox created:", sandbox.sandboxId);

        await ctx.runMutation(api.tasks.updateProjectSandbox, {
          id: projectId,
          sandboxId: sandbox.sandboxId,
        });
      }

      console.log("[render] creating media directories...");
      await ctx.runMutation(api.tasks.updateRenderProgress, {
        id: projectId,
        step: "preparing environment",
        details: "setting up media directories",
      });
      
      await sandbox.commands.run("mkdir -p /home/user/public/media /home/user/public/reelful");
      console.log("[render] media directories created");
      
      if (project.srtContent && project.srtContent.trim().length > 0) {
        console.log("[render] uploading srt via storage, length:", project.srtContent.length, "chars");
        const srtBuffer = Buffer.from(project.srtContent, 'utf-8');
        const srtUploadUrl = await ctx.runMutation(api.tasks.generateUploadUrl, {});
        const srtUploadResponse = await fetch(srtUploadUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: srtBuffer,
        });
        const { storageId: srtStorageId } = await srtUploadResponse.json();
        const srtUrl = await ctx.storage.getUrl(srtStorageId);
        
        if (srtUrl) {
          console.log("[render] downloading srt to sandbox");
          await sandbox.commands.run(`curl -o /home/user/public/reelful-fast.srt "${srtUrl}"`);
          await sandbox.commands.run(`curl -o /home/user/public/media/subtitles.srt "${srtUrl}"`);
          console.log("[render] srt files written via curl");
        }
      }
      
      console.log("[render] uploading media files...");
      await ctx.runMutation(api.tasks.updateRenderProgress, {
        id: projectId,
        step: "uploading media",
        details: "transferring files to sandbox",
      });
      
      if (project.fileMetadata && project.fileMetadata.length > 0) {
        console.log("[render] uploading original files with metadata...");
        console.log("[render] Note: Skipping images (they have been animated), only uploading videos");
        
        for (let i = 0; i < project.fileMetadata.length; i++) {
          const fileMeta = project.fileMetadata[i];
          
          // Skip images since they have been animated into videos
          if (fileMeta.contentType.startsWith('image/')) {
            console.log(`[render] Skipping image ${fileMeta.filename} (animated version will be used instead)`);
            continue;
          }
          
          // Only upload videos
          if (!fileMeta.contentType.startsWith('video/')) {
            console.log(`[render] Skipping non-video file ${fileMeta.filename} (${fileMeta.contentType})`);
            continue;
          }
          
          // Get fresh URL to avoid expiration issues
          const fileUrl = await ctx.storage.getUrl(fileMeta.storageId);
          if (!fileUrl) {
            console.log(`[render] skipping file ${i}: no URL available for ${fileMeta.filename}`);
            continue;
          }
          
          const sanitizedFilename = sanitizeFilename(fileMeta.filename);
          console.log(`[render] downloading video ${i + 1}/${project.fileMetadata.length}: ${fileMeta.filename} -> ${sanitizedFilename}`);
          
          try {
            // Use curl to download directly to sandbox - avoids loading large files into Convex action memory
            const sandboxPath = `/home/user/public/media/${sanitizedFilename}`;
            // Escape URL for shell: wrap in single quotes and escape any single quotes within
            const escapedUrl = fileUrl.replace(/'/g, "'\\''");
            const curlResult = await sandbox.commands.run(
              `curl -f -L -o "${sandboxPath}" '${escapedUrl}'`,
              { timeoutMs: 300000 } // 5 min timeout for large files
            );
            
            if (curlResult.exitCode !== 0) {
              throw new Error(`curl failed: ${curlResult.stderr}`);
            }
            
            // Verify file was downloaded
            const verifyResult = await sandbox.commands.run(`ls -lh "${sandboxPath}"`);
            console.log(`[render] ✓ downloaded ${sanitizedFilename} to sandbox: ${verifyResult.stdout}`);
            
            // Convert to MP4 and strip audio for better browser compatibility
            console.log(`[render] converting ${sanitizedFilename} to MP4 and stripping audio...`);
            const mp4Filename = sanitizedFilename.replace(/\.(mov|avi|webm|mkv)$/i, '.mp4');
            const mp4Path = `/home/user/public/media/${mp4Filename}`;
            
            // Convert to browser-compatible MP4 with H264 codec and strip audio
            const convertResult = await sandbox.commands.run(
              `ffmpeg -i "${sandboxPath}" -c:v libx264 -preset fast -crf 23 -an -movflags +faststart "${mp4Path}" -y`,
              { timeoutMs: 120000 }
            );
            
            if (convertResult.exitCode !== 0) {
              console.log(`[render] warning: conversion failed, trying simple copy: ${convertResult.stderr}`);
              // Fallback: just strip audio without re-encoding
              const fallbackResult = await sandbox.commands.run(
                `ffmpeg -i "${sandboxPath}" -c:v copy -an "${mp4Path}" -y`,
                { timeoutMs: 60000 }
              );
              if (fallbackResult.exitCode !== 0) {
                console.log(`[render] warning: audio stripping also failed, using original file: ${fallbackResult.stderr}`);
              } else {
                console.log(`[render] ✓ audio stripped (no conversion) -> ${mp4Filename}`);
                if (mp4Filename !== sanitizedFilename) {
                  await sandbox.commands.run(`rm "${sandboxPath}"`);
                }
              }
            } else {
              console.log(`[render] ✓ converted to MP4 and stripped audio -> ${mp4Filename}`);
              // Remove original if different filename
              if (mp4Filename !== sanitizedFilename) {
                await sandbox.commands.run(`rm "${sandboxPath}"`);
              }
            }
            
            // Verify the file exists and is readable
            const mp4VerifyResult = await sandbox.commands.run(`ls -lh "${mp4Path}"`);
            console.log(`[render] verification: ${mp4VerifyResult.stdout}`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to fetch file ${fileMeta.filename} (${i + 1}/${project.fileMetadata.length}): ${errorMsg}. This may be due to: 1) Expired storage URL (URLs expire after 1 hour), 2) Large file timeout, or 3) Network issues. Try re-uploading the file.`);
          }
        }
      } else if (project.files && project.files.length > 0) {
        console.log("[render] uploading original files (legacy, no metadata)...");
        for (let i = 0; i < project.files.length; i++) {
          const fileUrl = await ctx.storage.getUrl(project.files[i]);
          if (!fileUrl) {
            console.log(`[render] skipping file ${i}: no URL available`);
            continue;
          }
          
          console.log(`[render] downloading file ${i + 1}/${project.files.length}`);
          
          try {
            // Use curl to download directly to sandbox - avoids loading large files into Convex action memory
            const sandboxPath = `/home/user/public/media/file${i}`;
            // Escape URL for shell: wrap in single quotes and escape any single quotes within
            const escapedUrl = fileUrl.replace(/'/g, "'\\''");
            const curlResult = await sandbox.commands.run(
              `curl -f -L -o "${sandboxPath}" '${escapedUrl}'`,
              { timeoutMs: 300000 }
            );
            
            if (curlResult.exitCode !== 0) {
              throw new Error(`curl failed: ${curlResult.stderr}`);
            }
            
            const verifyResult = await sandbox.commands.run(`ls -lh "${sandboxPath}"`);
            console.log(`[render] ✓ downloaded file${i} to sandbox: ${verifyResult.stdout}`);
            
            // Try to strip audio (assuming it's a video, won't hurt if it's not)
            console.log(`[render] attempting to strip audio from file${i}`);
            const mutedPath = `/home/user/public/media/file${i}_muted`;
            const stripAudioResult = await sandbox.commands.run(
              `ffmpeg -i "${sandboxPath}" -c:v copy -an "${mutedPath}" -y 2>/dev/null && mv "${mutedPath}" "${sandboxPath}" || true`,
              { timeoutMs: 60000 }
            );
            console.log(`[render] audio stripping attempted for file${i}`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to fetch file ${i + 1}/${project.files.length}: ${errorMsg}. This may be due to expired storage URL or network issues.`);
          }
        }
      }
      
      
      
      if (project.audioUrl && project.audioUrl.includes("example.com")) {
        throw new Error("Cannot render: audioUrl (voiceover) is a simulated example.com URL. Please run AI processing first to generate real media files.");
      }
      
      if (project.audioUrl) {
        console.log("[render] downloading audio from:", project.audioUrl);
        // Use curl to download directly to sandbox - avoids loading files into Convex action memory
        const escapedUrl = project.audioUrl.replace(/'/g, "'\\''");
        
        // First check if file exists before downloading
        console.log("[render] checking if audio URL is accessible...");
        const testResult = await sandbox.commands.run(
          `curl -I -f -L '${escapedUrl}' 2>&1 | head -5`,
          { timeoutMs: 30000 }
        );
        console.log("[render] URL headers:", testResult.stdout);
        
        const curlResult = await sandbox.commands.run(
          `curl -f -L -o "/home/user/public/media/audio.mp3" '${escapedUrl}' 2>&1`,
          { timeoutMs: 300000 }
        );
        
        // Log curl output for debugging
        if (curlResult.stdout) {
          console.log("[render] curl stdout:", curlResult.stdout);
        }
        if (curlResult.stderr) {
          console.log("[render] curl stderr:", curlResult.stderr);
        }
        
        if (curlResult.exitCode !== 0) {
          throw new Error(`Failed to download audio: ${curlResult.stderr || curlResult.stdout}`);
        }
        
        // Verify file was downloaded and check size in bytes
        const sizeResult = await sandbox.commands.run(`stat -f%z "/home/user/public/media/audio.mp3" 2>/dev/null || stat -c%s "/home/user/public/media/audio.mp3"`);
        const fileSizeBytes = parseInt(sizeResult.stdout.trim() || "0");
        
        // Also check what the file actually contains (first 200 chars) to see if it's an error page
        const fileContentCheck = await sandbox.commands.run(`head -c 200 "/home/user/public/media/audio.mp3" 2>/dev/null || echo "cannot read file"`);
        console.log("[render] downloaded file first 200 bytes:", fileContentCheck.stdout);
        
        if (fileSizeBytes < 1000) {
          const verifyResult = await sandbox.commands.run(`ls -lh /home/user/public/media/audio.mp3 2>&1 || echo "file not found"`);
          throw new Error(`audioUrl (voiceover) file is too small (${fileSizeBytes} bytes). This likely means the URL is invalid or returns an error page. File info: ${verifyResult.stdout}. First 200 bytes: ${fileContentCheck.stdout}`);
        }
        
        // Check if file is actually an MP3 (should start with ID3 tag or FF FB for MP3)
        const magicBytes = await sandbox.commands.run(`hexdump -n 3 -C "/home/user/public/media/audio.mp3" 2>/dev/null | head -1`);
        console.log("[render] file magic bytes:", magicBytes.stdout);
        
        console.log("[render] ✓ audio downloaded, size:", fileSizeBytes, "bytes");
      }

      if (project.musicUrl) {
        if (project.musicUrl.includes("example.com")) {
          throw new Error("Cannot render: musicUrl (background music) is a simulated example.com URL. Please run AI processing first to generate real media files.");
        }
        
        console.log("[render] downloading music from:", project.musicUrl);
        // Use curl to download directly to sandbox - avoids loading files into Convex action memory
        const escapedUrl = project.musicUrl.replace(/'/g, "'\\''");
        const curlResult = await sandbox.commands.run(
          `curl -f -L -o "/home/user/public/media/music.mp3" '${escapedUrl}'`,
          { timeoutMs: 300000 }
        );
        
        if (curlResult.exitCode !== 0) {
          throw new Error(`Failed to download music: ${curlResult.stderr}`);
        }
        
        // Verify file was downloaded and check size in bytes
        const sizeResult = await sandbox.commands.run(`stat -f%z "/home/user/public/media/music.mp3" 2>/dev/null || stat -c%s "/home/user/public/media/music.mp3"`);
        const fileSizeBytes = parseInt(sizeResult.stdout.trim() || "0");
        
        if (fileSizeBytes < 1000) {
          const verifyResult = await sandbox.commands.run(`ls -lh /home/user/public/media/music.mp3 2>&1 || echo "file not found"`);
          throw new Error(`musicUrl (background music) file is too small (${fileSizeBytes} bytes). This likely means the URL is invalid or returns an error page. File info: ${verifyResult.stdout}`);
        }
        console.log("[render] ✓ music downloaded, size:", fileSizeBytes, "bytes");
      }

      if (project.videoUrls && project.videoUrls.length > 0) {
        console.log(`[render] Downloading ${project.videoUrls.length} FAL-animated videos (from images)...`);
        
        for (let i = 0; i < project.videoUrls.length; i++) {
          if (project.videoUrls[i].includes("example.com")) {
            throw new Error(`Cannot render: videoUrls[${i}] (animated video ${i + 1}) is a simulated example.com URL. Please run AI processing first to generate real media files.`);
          }
          
          console.log(`[render] Downloading FAL-animated video ${i + 1}/${project.videoUrls.length} from:`, project.videoUrls[i].substring(0, 80));
          // Use curl to download directly to sandbox - avoids loading large files into Convex action memory
          const escapedUrl = project.videoUrls[i].replace(/'/g, "'\\''");
          const curlResult = await sandbox.commands.run(
            `curl -f -L -o "/home/user/public/media/video${i}.mp4" '${escapedUrl}'`,
            { timeoutMs: 300000 }
          );
          
          if (curlResult.exitCode !== 0) {
            throw new Error(`Failed to download FAL video ${i + 1}: ${curlResult.stderr}`);
          }
          
          // Verify file was downloaded and check size in bytes
          const sizeResult = await sandbox.commands.run(`stat -f%z "/home/user/public/media/video${i}.mp4" 2>/dev/null || stat -c%s "/home/user/public/media/video${i}.mp4"`);
          const fileSizeBytes = parseInt(sizeResult.stdout.trim() || "0");
          
          if (fileSizeBytes < 1000) {
            const verifyResult = await sandbox.commands.run(`ls -lh /home/user/public/media/video${i}.mp4 2>&1 || echo "file not found"`);
            throw new Error(`videoUrls[${i}] (animated video ${i + 1}) file is too small (${fileSizeBytes} bytes). This likely means the URL is invalid or returns an error page. File info: ${verifyResult.stdout}`);
          }
          console.log(`[render] ✓ Downloaded FAL-animated video as video${i}.mp4, size: ${fileSizeBytes} bytes`);
          
          if (i === 0) {
            // Copy first video to reelful directory
            await sandbox.commands.run(`cp "/home/user/public/media/video${i}.mp4" "/home/user/public/reelful/video_2025-10-10_18-12-33%20(2).mp4"`);
          }
        }
        console.log(`[render] ✓ All ${project.videoUrls.length} FAL-animated videos downloaded`);
      } else {
        console.log("[render] No FAL-animated videos to download (no images were animated)");
      }
      console.log("[render] files downloaded");

      // Clean up any temporary download files to free disk space
      console.log("[render] cleaning up temporary files after upload...");
      await sandbox.commands.run(`rm -rf /tmp/* 2>/dev/null || true`);
      
      const diskUsage = await sandbox.commands.run(`df -h /home/user`);
      console.log("[render] disk usage after upload:", diskUsage.stdout);

      // List all media files for debugging
      const mediaFiles = await sandbox.commands.run(`ls -lh /home/user/public/media/`);
      console.log("[render] media files available:", mediaFiles.stdout);

      console.log("[render] running claude agent to edit video...");
      await ctx.runMutation(api.tasks.updateRenderProgress, {
        id: projectId,
        step: "claude video editing",
        details: "claude is analyzing footage and creating composition",
      });
      
      const videoEditorPrompt = prompts.videoEditor.generate(project.prompt || 'create an engaging social media video');

      console.log("[render] writing prompt via command to avoid timeout");
      const promptBase64 = Buffer.from(videoEditorPrompt).toString('base64');
      await sandbox.commands.run(`echo '${promptBase64}' | base64 -d > /home/user/prompt.txt`);
      
      const claudeResult = await sandbox.commands.run(
        `bun run claude-agent.ts`,
        { 
          cwd: "/home/user",
          timeoutMs: 600000,
          requestTimeoutMs: 600000,
        }
      );
      console.log("[render] claude exit code:", claudeResult.exitCode);
      console.log("[render] claude output (last 1000 chars):", claudeResult.stdout.slice(-1000));
      
      if (claudeResult.exitCode !== 0) {
        console.log("[render] claude failed:", claudeResult.stderr);
        throw new Error(`claude video editing failed: ${claudeResult.stderr}`);
      }

      console.log("[render] claude completed, now cleaning up disk space...");
      await ctx.runMutation(api.tasks.updateRenderProgress, {
        id: projectId,
        step: "preparing render",
        details: "cleaning up temporary files to free disk space",
      });

      // Clean up temporary files and caches to free disk space
      await sandbox.commands.run(`
        rm -rf /tmp/* /var/tmp/* 2>/dev/null || true;
        rm -rf ~/.bun/install/cache/* 2>/dev/null || true;
        rm -rf ~/.cache/* 2>/dev/null || true;
        rm -rf /home/user/.cache/* 2>/dev/null || true;
        rm -rf /home/user/node_modules/.cache/* 2>/dev/null || true;
      `);
      
      console.log("[render] disk cleanup complete, checking disk usage...");
      const diskCheck = await sandbox.commands.run(`df -h /home/user`);
      console.log("[render] disk usage:", diskCheck.stdout);

      console.log("[render] running remotion render...");
      await ctx.runMutation(api.tasks.updateRenderProgress, {
        id: projectId,
        step: "rendering video",
        details: "running bun remotion render",
      });

      const remotionResult = await sandbox.commands.run(
        `bun remotion render`,
        { 
          cwd: "/home/user",
          timeoutMs: 3600000,
          requestTimeoutMs: 3600000,
        }
      );

      console.log("[render] remotion exit code:", remotionResult.exitCode);
      console.log("[render] remotion stdout:", remotionResult.stdout);
      
      if (remotionResult.exitCode !== 0) {
        console.log("[render] remotion failed:", remotionResult.stderr);
        throw new Error(`remotion render failed: ${remotionResult.stderr}`);
      }

      console.log("[render] remotion completed, checking output...");
      await ctx.runMutation(api.tasks.updateRenderProgress, {
        id: projectId,
        step: "finalizing video",
        details: "retrieving rendered video from sandbox",
      });

      console.log("[render] checking output directory...");
      const lsResult = await sandbox.commands.run("ls -lah /home/user/out/ 2>/dev/null || echo 'out directory not found'");
      console.log("[render] out directory contents:", lsResult.stdout);

      const findResult = await sandbox.commands.run("find /home/user/out -name '*.mp4' 2>/dev/null || echo 'no mp4 files found'");
      console.log("[render] mp4 files in out/:", findResult.stdout);

      console.log("[render] checking output video exists...");
      const videoPath = "/home/user/out/Main.mp4";
      
      const statResult = await sandbox.commands.run(`stat "${videoPath}" 2>&1`);
      if (statResult.exitCode !== 0) {
        console.log("[render] Main.mp4 not found");
        const claudeOutput = claudeResult.stdout || "";
        const hasMemoryError = claudeOutput.includes("memory") || claudeOutput.includes("killed");
        
        if (hasMemoryError) {
          throw new Error("render failed due to insufficient memory - claude created the composition but couldn't render it. retry rendering with 'bun remotion render'");
        }
        
        throw new Error(`output video not found at ${videoPath}. retry rendering with 'bun remotion render'`);
      }
      
      const sizeResult = await sandbox.commands.run(`stat -f%z "${videoPath}" 2>/dev/null || stat -c%s "${videoPath}" 2>/dev/null`);
      const outputSize = parseInt(sizeResult.stdout.trim() || "0");
      console.log("[render] output video size:", outputSize, "bytes at path:", videoPath);
      
      if (outputSize === 0 || outputSize < 1000) {
        throw new Error(`output video is too small (${outputSize} bytes). retry rendering with 'bun remotion render'`);
      }

      console.log("[render] generating download url for output video...");
      const downloadUrl = await sandbox.downloadUrl(videoPath, {
        useSignatureExpiration: 300000,
      });
      console.log("[render] download url generated, fetching file...");

      await ctx.runMutation(api.tasks.updateRenderProgress, {
        id: projectId,
        step: "downloading video",
        details: "fetching rendered file from sandbox",
      });

      const videoResponse = await fetch(downloadUrl);
      if (!videoResponse.ok) {
        throw new Error(`failed to download video: ${videoResponse.statusText}`);
      }
      
      const videoBuffer = await videoResponse.arrayBuffer();
      const actualSize = videoBuffer.byteLength;
      console.log("[render] video downloaded, size:", actualSize, "bytes");

      if (actualSize < 1000) {
        throw new Error(`output video is too small (${actualSize} bytes). retry rendering with 'bun remotion render'`);
      }

      console.log("[render] uploading to convex storage...");
      await ctx.runMutation(api.tasks.updateRenderProgress, {
        id: projectId,
        step: "saving video",
        details: "uploading to permanent storage",
      });

      const uploadUrl: string = await ctx.runMutation(api.tasks.generateUploadUrl, {});
      const uploadResponse: Response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "video/mp4" },
        body: videoBuffer,
      });
      const { storageId }: { storageId: Id<"_storage"> } = await uploadResponse.json();
      const renderedVideoUrl: string | null = await ctx.storage.getUrl(storageId);
      console.log("[render] uploaded to storage, url:", renderedVideoUrl);

      console.log("[render] updating project with result...");
      await ctx.runMutation(api.tasks.updateProjectWithRenderResult, {
        id: projectId,
        renderedVideoUrl: renderedVideoUrl || undefined,
        status: "completed",
      });

      console.log("[render] render complete! killing sandbox...");
      try {
        await sandbox.kill();
        console.log("[render] sandbox killed successfully");
      } catch (killError) {
        console.log("[render] failed to kill sandbox:", killError);
      }
      
      return { success: true, renderedVideoUrl };
    } catch (error) {
      console.error("[render] error:", error);
      await ctx.runMutation(api.tasks.updateProjectWithRenderResult, {
        id: projectId,
        error: error instanceof Error ? error.message : "render failed",
        status: "failed",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "render failed",
      };
    }
  },
});

export const getPipelineStatus = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }): Promise<{
    sandboxExists: boolean;
    sandboxAlive: boolean;
    mediaUploaded: boolean;
    sequenceCreated: boolean;
    videoRendered: boolean;
  }> => {
    const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
    if (!project) {
      return {
        sandboxExists: false,
        sandboxAlive: false,
        mediaUploaded: false,
        sequenceCreated: false,
        videoRendered: false,
      };
    }

    if (!project.sandboxId) {
      return {
        sandboxExists: false,
        sandboxAlive: false,
        mediaUploaded: false,
        sequenceCreated: false,
        videoRendered: false,
      };
    }

    try {
      if (!process.env.E2B_API_KEY) {
        throw new Error("E2B_API_KEY not set");
      }

      const sandbox = await Sandbox.connect(project.sandboxId, { timeoutMs: 3600000 });
      
      // check if sandbox is alive
      try {
        await sandbox.commands.run("echo alive", { timeoutMs: 10000 });
      } catch {
        return {
          sandboxExists: true,
          sandboxAlive: false,
          mediaUploaded: false,
          sequenceCreated: false,
          videoRendered: false,
        };
      }

      // check if media files are uploaded
      const mediaCheck = await sandbox.commands.run("ls /home/user/public/media/ 2>/dev/null | wc -l");
      const mediaCount = parseInt(mediaCheck.stdout.trim() || "0");
      const mediaUploaded = mediaCount > 0;

      // check if composition exists (claude finished)
      const compositionCheck = await sandbox.commands.run("ls /home/user/src/ 2>/dev/null | grep -i composition | wc -l");
      const compositionCount = parseInt(compositionCheck.stdout.trim() || "0");
      const sequenceCreated = compositionCount > 0;

      // check if video is rendered
      const videoCheck = await sandbox.commands.run("ls /home/user/out/Main.mp4 2>/dev/null");
      const videoRendered = videoCheck.exitCode === 0;

      return {
        sandboxExists: true,
        sandboxAlive: true,
        mediaUploaded,
        sequenceCreated,
        videoRendered,
      };
    } catch (error) {
      return {
        sandboxExists: true,
        sandboxAlive: false,
        mediaUploaded: false,
        sequenceCreated: false,
        videoRendered: false,
      };
    }
  },
});

export const getSandboxInfo = action({
  args: {
    sandboxId: v.string(),
  },
  handler: async (ctx, { sandboxId }) => {
    try {
      if (!process.env.E2B_API_KEY) {
        throw new Error("E2B_API_KEY not set");
      }

      const sandbox = await Sandbox.connect(sandboxId, {
        timeoutMs: 3600000,
      });
      
      const lsResult = await sandbox.commands.run("ls -lah /home/user/out/ 2>/dev/null || echo 'out directory not found'");
      const diskResult = await sandbox.commands.run("df -h /home/user");
      
      return {
        success: true,
        sandboxId: sandbox.sandboxId,
        outDirectory: lsResult.stdout,
        diskUsage: diskResult.stdout,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "failed to connect to sandbox",
      };
    }
  },
});

export const runSandboxCommand = action({
  args: {
    sandboxId: v.string(),
    command: v.string(),
  },
  handler: async (ctx, { sandboxId, command }) => {
    try {
      if (!process.env.E2B_API_KEY) {
        throw new Error("E2B_API_KEY not set");
      }

      const sandbox = await Sandbox.connect(sandboxId, {
        timeoutMs: 3600000,
      });
      
      const result = await sandbox.commands.run(command, {
        cwd: "/home/user",
        timeoutMs: 3_600_000,
      });
      
      return {
        success: true,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "failed to run command",
      };
    }
  },
});

export const listSandboxFiles = action({
  args: {
    sandboxId: v.string(),
    path: v.optional(v.string()),
  },
  handler: async (ctx, { sandboxId, path = "/home/user/out" }) => {
    try {
      if (!process.env.E2B_API_KEY) {
        throw new Error("E2B_API_KEY not set");
      }

      const sandbox = await Sandbox.connect(sandboxId, {
        timeoutMs: 3600000,
      });
      
      const files = await sandbox.files.list(path);
      
      return {
        success: true,
        files: files.map(f => ({
          name: f.name,
          path: f.path,
          isDir: f.type === "dir",
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "failed to list files",
      };
    }
  },
});

export const readSandboxFile = action({
  args: {
    sandboxId: v.string(),
    filePath: v.string(),
  },
  handler: async (ctx, { sandboxId, filePath }) => {
    try {
      if (!process.env.E2B_API_KEY) {
        throw new Error("E2B_API_KEY not set");
      }

      const sandbox = await Sandbox.connect(sandboxId, {
        timeoutMs: 3600000,
      });
      
      const content = await sandbox.files.read(filePath);
      
      let base64Content = "";
      if (typeof content === 'string') {
        base64Content = Buffer.from(content).toString('base64');
      } else {
        const uint8Array = new Uint8Array(content as ArrayBuffer);
        base64Content = Buffer.from(uint8Array).toString('base64');
      }
      
      return {
        success: true,
        content: base64Content,
        isText: typeof content === 'string',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "failed to read file",
      };
    }
  },
});

export const getSandboxFileDownloadUrl = action({
  args: {
    sandboxId: v.string(),
    filePath: v.string(),
  },
  handler: async (ctx, { sandboxId, filePath }) => {
    try {
      if (!process.env.E2B_API_KEY) {
        throw new Error("E2B_API_KEY not set");
      }

      const sandbox = await Sandbox.connect(sandboxId, {
        timeoutMs: 3600000,
      });
      
      const downloadUrl = await sandbox.downloadUrl(filePath, {
        useSignatureExpiration: 300_000,
      });
      
      return {
        success: true,
        downloadUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "failed to get download url",
      };
    }
  },
});

export const downloadSandboxFolder = action({
  args: {
    sandboxId: v.string(),
    folderPath: v.string(),
  },
  handler: async (ctx, { sandboxId, folderPath }) => {
    try {
      if (!process.env.E2B_API_KEY) {
        throw new Error("E2B_API_KEY not set");
      }

      const sandbox = await Sandbox.connect(sandboxId, {
        timeoutMs: 3600000,
      });
      
      const result = await sandbox.commands.run(
        `cd ${folderPath} && zip -r /tmp/folder.zip . && base64 /tmp/folder.zip`,
        { timeoutMs: 60000 }
      );
      
      if (result.exitCode !== 0) {
        throw new Error(`failed to create archive: ${result.stderr}`);
      }
      
      return {
        success: true,
        base64Content: result.stdout.trim(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "failed to download folder",
      };
    }
  },
});



export const createSequence = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }): Promise<{ success: boolean; sandboxId?: string; error?: string }> => {
    console.log("[sequence] starting sequence creation for project:", projectId);
    
    try {
      const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
      if (!project) {
        throw new Error("project not found");
      }

      if (!process.env.E2B_API_KEY) {
        throw new Error("E2B_API_KEY not set");
      }
      
      const claudeToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
      if (!claudeToken) {
        throw new Error("CLAUDE_CODE_OAUTH_TOKEN not set");
      }

      let sandbox;
      if (project.sandboxId) {
        console.log("[sequence] attempting to connect to existing sandbox");
        try {
          sandbox = await Sandbox.connect(project.sandboxId, { timeoutMs: 3600000 });
          console.log("[sequence] connected to existing sandbox");
        } catch {
          console.log("[sequence] sandbox is dead, creating new one");
          sandbox = null;
        }
      }

      if (!sandbox) {
        console.log("[sequence] creating new sandbox...");
        await ctx.runMutation(api.tasks.updateRenderProgress, {
          id: projectId,
          step: "creating sandbox",
          details: "initializing e2b environment",
        });
        
        sandbox = await Sandbox.betaCreate("8r14p0kvwebvpgno5hia", {
          autoPause: true,
          timeoutMs: 3600000,
          envs: { CLAUDE_CODE_OAUTH_TOKEN: claudeToken },
        });

        sandbox.setTimeout(3600000);

        console.log("[sequence] sandbox created:", sandbox.sandboxId);
        
        await ctx.runMutation(api.tasks.updateProjectSandbox, {
          id: projectId,
          sandboxId: sandbox.sandboxId,
        });
      }

      console.log("[sequence] preparing media files...");
      await ctx.runMutation(api.tasks.updateRenderProgress, {
        id: projectId,
        step: "uploading media",
        details: "transferring files to sandbox",
      });
      
      await sandbox.commands.run("mkdir -p /home/user/public/media /home/user/public/reelful");
      
      if (project.srtContent && project.srtContent.trim().length > 0) {
        console.log("[render] writing existing srt content, length:", project.srtContent.length, "chars");
        await sandbox.files.write("/home/user/public/reelful-fast.srt", project.srtContent);
        await sandbox.files.write("/home/user/public/media/subtitles.srt", project.srtContent);
        console.log("[render] srt files written");
      } else {
        console.log("[render] no srt content found, skipping srt file creation");
      }

      if (project.audioUrl) {
        console.log("[sequence] downloading audio from:", project.audioUrl);
        // Use curl to download directly to sandbox - avoids loading files into Convex action memory
        const escapedUrl = project.audioUrl.replace(/'/g, "'\\''");
        const curlResult = await sandbox.commands.run(
          `curl -f -L -o "/home/user/public/media/audio.mp3" '${escapedUrl}'`,
          { timeoutMs: 300000 }
        );
        
        if (curlResult.exitCode !== 0) {
          throw new Error(`Failed to download audio: ${curlResult.stderr}`);
        }
        console.log("[sequence] ✓ audio downloaded");
      }

      if (project.musicUrl) {
        console.log("[sequence] downloading music from:", project.musicUrl);
        // Use curl to download directly to sandbox - avoids loading files into Convex action memory
        const escapedUrl = project.musicUrl.replace(/'/g, "'\\''");
        const curlResult = await sandbox.commands.run(
          `curl -f -L -o "/home/user/public/media/music.mp3" '${escapedUrl}'`,
          { timeoutMs: 300000 }
        );
        
        if (curlResult.exitCode !== 0) {
          throw new Error(`Failed to download music: ${curlResult.stderr}`);
        }
        console.log("[sequence] ✓ music downloaded");
      }

      if (project.videoUrls && project.videoUrls.length > 0) {
        console.log(`[sequence] downloading ${project.videoUrls.length} FAL-animated videos...`);
        for (let i = 0; i < project.videoUrls.length; i++) {
          const escapedUrl = project.videoUrls[i].replace(/'/g, "'\\''");
          const curlResult = await sandbox.commands.run(
            `curl -f -L -o "/home/user/public/media/video${i}.mp4" '${escapedUrl}'`,
            { timeoutMs: 300000 }
          );
          
          if (curlResult.exitCode !== 0) {
            throw new Error(`Failed to download FAL video ${i + 1}: ${curlResult.stderr}`);
          }
          
          if (i === 0) {
            // Copy first video to reelful directory
            await sandbox.commands.run(`cp "/home/user/public/media/video${i}.mp4" "/home/user/public/reelful/video_2025-10-10_18-12-33%20(2).mp4"`);
          }
        }
        console.log(`[sequence] ✓ All ${project.videoUrls.length} FAL-animated videos downloaded`);
      }

      console.log("[sequence] running claude agent to edit video...");
      await ctx.runMutation(api.tasks.updateRenderProgress, {
        id: projectId,
        step: "claude video editing",
        details: "claude is analyzing footage and creating composition",
      });
      
      const videoEditorPrompt = prompts.videoEditor.generate(project.prompt || 'create an engaging social media video');

      await sandbox.files.write("/home/user/prompt.txt", videoEditorPrompt);
      
      const claudeResult = await sandbox.commands.run(`bun run claude-agent.ts`, {
        cwd: "/home/user",
        timeoutMs: 600000,
        requestTimeoutMs: 600000,
      });
      
      if (claudeResult.exitCode !== 0) {
        throw new Error(`claude editing failed: ${claudeResult.stderr}`);
      }

      console.log("[sequence] sequence created successfully");
      return { success: true, sandboxId: sandbox.sandboxId };
    } catch (error) {
      console.error("[sequence] error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "sequence creation failed",
      };
    }
  },
});

export const renderFinalVideo = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }): Promise<{ success: boolean; renderedVideoUrl?: string | null; error?: string }> => {
    console.log("[render-final] starting final render for project:", projectId);
    
    try {
      const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
      if (!project) {
        throw new Error("project not found");
      }

      if (!project.sandboxId) {
        throw new Error("no sandbox found - create sequence first");
      }

      console.log("[render-final] connecting to sandbox:", project.sandboxId);
      const sandbox = await Sandbox.connect(project.sandboxId, { timeoutMs: 3600000 });

      console.log("[render-final] cleaning up disk space before render...");
      await ctx.runMutation(api.tasks.updateRenderProgress, {
        id: projectId,
        step: "preparing render",
        details: "cleaning up temporary files to free disk space",
      });

      // Clean up temporary files and caches to free disk space
      await sandbox.commands.run(`
        rm -rf /tmp/* /var/tmp/* 2>/dev/null || true;
        rm -rf ~/.bun/install/cache/* 2>/dev/null || true;
        rm -rf ~/.cache/* 2>/dev/null || true;
        rm -rf /home/user/.cache/* 2>/dev/null || true;
        rm -rf /home/user/node_modules/.cache/* 2>/dev/null || true;
      `);
      
      const diskCheck = await sandbox.commands.run(`df -h /home/user`);
      console.log("[render-final] disk usage after cleanup:", diskCheck.stdout);

      console.log("[render-final] running remotion render...");
      await ctx.runMutation(api.tasks.updateRenderProgress, {
        id: projectId,
        step: "rendering video",
        details: "running bun remotion render",
      });

      const remotionResult = await sandbox.commands.run(`bun remotion render`, {
        cwd: "/home/user",
        timeoutMs: 3600000,
        requestTimeoutMs: 3600000,
      });

      if (remotionResult.exitCode !== 0) {
        throw new Error(`remotion render failed: ${remotionResult.stderr}`);
      }

      console.log("[render-final] checking output video...");
      const videoPath = "/home/user/out/Main.mp4";
      
      const statResult = await sandbox.commands.run(`stat "${videoPath}" 2>&1`);
      if (statResult.exitCode !== 0) {
        throw new Error(`output video not found at ${videoPath}`);
      }
      
      const sizeResult = await sandbox.commands.run(`stat -f%z "${videoPath}" 2>/dev/null || stat -c%s "${videoPath}" 2>/dev/null`);
      const outputSize = parseInt(sizeResult.stdout.trim() || "0");
      
      if (outputSize < 1000) {
        throw new Error(`output video too small (${outputSize} bytes)`);
      }

      console.log("[render-final] downloading video...");
      const downloadUrl = await sandbox.downloadUrl(videoPath, { useSignatureExpiration: 300000 });
      const videoResponse = await fetch(downloadUrl);
      
      if (!videoResponse.ok) {
        throw new Error(`failed to download video: ${videoResponse.statusText}`);
      }
      
      const videoBuffer = await videoResponse.arrayBuffer();

      console.log("[render-final] uploading to convex storage...");
      const uploadUrl: string = await ctx.runMutation(api.tasks.generateUploadUrl, {});
      const uploadResponse: Response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "video/mp4" },
        body: videoBuffer,
      });
      const { storageId }: { storageId: Id<"_storage"> } = await uploadResponse.json();
      const renderedVideoUrl: string | null = await ctx.storage.getUrl(storageId);

      console.log("[render-final] uploaded to storage, killing sandbox...");
      try {
        await sandbox.kill();
      } catch (killError) {
        console.log("[render-final] failed to kill sandbox:", killError);
      }

      return { success: true, renderedVideoUrl };
    } catch (error) {
      console.error("[render-final] error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "render failed",
      };
    }
  },
});

export const step1StartSandbox = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }): Promise<{ success: boolean; sandboxId?: string; error?: string }> => {
    console.log("[step1] starting sandbox for project:", projectId);
    
    try {
      await ctx.runMutation(api.tasks.updateRenderStep, {
        id: projectId,
        step: "creating_sandbox",
      });

      const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
      if (!project) throw new Error("project not found");

      const claudeToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
      if (!claudeToken) throw new Error("CLAUDE_CODE_OAUTH_TOKEN not set");

      let sandbox;
      if (project.sandboxId) {
        console.log("[step1] trying to connect to existing sandbox:", project.sandboxId);
        try {
          sandbox = await Sandbox.connect(project.sandboxId, { timeoutMs: 3600000 });
          await sandbox.commands.run("echo alive");
          console.log("[step1] existing sandbox is alive");
        } catch {
          console.log("[step1] existing sandbox dead, creating new one");
          sandbox = null;
        }
      }

      if (!sandbox) {
        console.log("[step1] creating new sandbox...");
        sandbox = await Sandbox.betaCreate("8r14p0kvwebvpgno5hia", {
          autoPause: true,
          timeoutMs: 3600000,
          envs: { CLAUDE_CODE_OAUTH_TOKEN: claudeToken },
        });

        sandbox.setTimeout(3600000);

        console.log("[step1] sandbox created:", sandbox.sandboxId);
        
        await ctx.runMutation(api.tasks.updateProjectSandbox, {
          id: projectId,
          sandboxId: sandbox.sandboxId,
        });
      }

      await sandbox.commands.run("mkdir -p /home/user/public/media /home/user/public/reelful");

      return { success: true, sandboxId: sandbox.sandboxId };
    } catch (error) {
      console.error("[step1] error:", error);
      await ctx.runMutation(api.tasks.updateRenderStep, {
        id: projectId,
        step: "failed",
        error: error instanceof Error ? error.message : "sandbox creation failed",
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "sandbox creation failed",
      };
    }
  },
});

export const step2UploadFiles = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }): Promise<{ success: boolean; error?: string }> => {
    console.log("[step2] uploading files for project:", projectId);
    
    try {
      await ctx.runMutation(api.tasks.updateRenderStep, {
        id: projectId,
        step: "uploading_media",
      });

      const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
      if (!project) throw new Error("project not found");
      if (!project.sandboxId) throw new Error("sandbox not found");

      const sandbox = await Sandbox.connect(project.sandboxId, { timeoutMs: 3600000 });

      if (project.srtContent && project.srtContent.trim().length > 0) {
        console.log("[step2] uploading srt via storage (generated with voice)");
        const srtBuffer = Buffer.from(project.srtContent, 'utf-8');
        const srtUploadUrl = await ctx.runMutation(api.tasks.generateUploadUrl, {});
        const srtUploadResponse = await fetch(srtUploadUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: srtBuffer,
        });
        const { storageId: srtStorageId } = await srtUploadResponse.json();
        const srtUrl = await ctx.storage.getUrl(srtStorageId);
        
        if (srtUrl) {
          await sandbox.commands.run(`curl -o /home/user/public/reelful-fast.srt "${srtUrl}"`);
          await sandbox.commands.run(`curl -o /home/user/public/media/subtitles.srt "${srtUrl}"`);
          console.log("[step2] ✓ SRT file uploaded to sandbox (subtitles.srt and reelful-fast.srt)");
        }
      } else {
        console.warn("[step2] ⚠️  No SRT content found - voice generation may not have completed. Step 3 will fail without SRT.");
      }

      if (project.fileMetadata && project.fileMetadata.length > 0) {
        console.log("[step2] Note: Skipping images (they have been animated), only uploading videos");
        
        for (let i = 0; i < project.fileMetadata.length; i++) {
          const fileMeta = project.fileMetadata[i];
          
          // Skip images since they have been animated into videos
          if (fileMeta.contentType.startsWith('image/')) {
            console.log(`[step2] Skipping image ${fileMeta.filename} (animated version will be used instead)`);
            continue;
          }
          
          // Only upload videos
          if (!fileMeta.contentType.startsWith('video/')) {
            console.log(`[step2] Skipping non-video file ${fileMeta.filename} (${fileMeta.contentType})`);
            continue;
          }
          
          // Get fresh URL to avoid expiration issues
          const fileUrl = await ctx.storage.getUrl(fileMeta.storageId);
          if (!fileUrl) {
            console.log(`[step2] skipping file ${i}: no URL available for ${fileMeta.filename}`);
            continue;
          }
          
          const sanitizedFilename = sanitizeFilename(fileMeta.filename);
          console.log(`[step2] downloading video ${fileMeta.filename} -> ${sanitizedFilename}`);
          
          try {
            // Use curl to download directly to sandbox - avoids loading large files into Convex action memory
            const sandboxPath = `/home/user/public/media/${sanitizedFilename}`;
            // Escape URL for shell: wrap in single quotes and escape any single quotes within
            const escapedUrl = fileUrl.replace(/'/g, "'\\''");
            const curlResult = await sandbox.commands.run(
              `curl -f -L -o "${sandboxPath}" '${escapedUrl}'`,
              { timeoutMs: 300000 } // 5 min timeout for large files
            );
            
            if (curlResult.exitCode !== 0) {
              throw new Error(`curl failed: ${curlResult.stderr}`);
            }
            
            // Verify file was downloaded
            const verifyResult = await sandbox.commands.run(`ls -lh "${sandboxPath}"`);
            console.log(`[step2] ✓ downloaded ${sanitizedFilename} to sandbox: ${verifyResult.stdout}`);
            
            // Strip audio from the video so only voiceover and background music play
            console.log(`[step2] stripping audio from ${sanitizedFilename} to ensure only voiceover and music are heard`);
            const mutedPath = `/home/user/public/media/${sanitizedFilename.replace(/\.(mp4|mov|avi|webm)$/i, '_muted.mp4')}`;
            const stripAudioResult = await sandbox.commands.run(
              `ffmpeg -i "${sandboxPath}" -c:v copy -an "${mutedPath}" -y && mv "${mutedPath}" "${sandboxPath}"`,
              { timeoutMs: 60000 }
            );
            
            if (stripAudioResult.exitCode !== 0) {
              console.log(`[step2] warning: failed to strip audio from ${sanitizedFilename}, will use original: ${stripAudioResult.stderr}`);
            } else {
              console.log(`[step2] ✓ audio stripped from ${sanitizedFilename}`);
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to download file ${fileMeta.filename}: ${errorMsg}. Storage URLs expire after 1 hour - try re-uploading the file if it's been a while.`);
          }
        }
      }

      if (project.audioUrl) {
        console.log("[step2] downloading audio from:", project.audioUrl);
        // Use curl to download directly to sandbox - avoids loading files into Convex action memory
        const escapedUrl = project.audioUrl.replace(/'/g, "'\\''");
        const curlResult = await sandbox.commands.run(
          `curl -f -L -o "/home/user/public/media/audio.mp3" '${escapedUrl}'`,
          { timeoutMs: 300000 }
        );
        
        if (curlResult.exitCode !== 0) {
          throw new Error(`Failed to download audio: ${curlResult.stderr}`);
        }
        console.log("[step2] ✓ audio downloaded");
      }

      if (project.musicUrl) {
        console.log("[step2] downloading music from:", project.musicUrl);
        // Use curl to download directly to sandbox - avoids loading files into Convex action memory
        const escapedUrl = project.musicUrl.replace(/'/g, "'\\''");
        const curlResult = await sandbox.commands.run(
          `curl -f -L -o "/home/user/public/media/music.mp3" '${escapedUrl}'`,
          { timeoutMs: 300000 }
        );
        
        if (curlResult.exitCode !== 0) {
          throw new Error(`Failed to download music: ${curlResult.stderr}`);
        }
        console.log("[step2] ✓ music downloaded");
      }

      if (project.videoUrls && project.videoUrls.length > 0) {
        console.log(`[step2] Downloading ${project.videoUrls.length} FAL-animated videos (from images)...`);
        
        for (let i = 0; i < project.videoUrls.length; i++) {
          console.log(`[step2] Downloading FAL-animated video ${i + 1}/${project.videoUrls.length}`);
          // Use curl to download directly to sandbox - avoids loading large files into Convex action memory
          const escapedUrl = project.videoUrls[i].replace(/'/g, "'\\''");
          const curlResult = await sandbox.commands.run(
            `curl -f -L -o "/home/user/public/media/video${i}.mp4" '${escapedUrl}'`,
            { timeoutMs: 300000 }
          );
          
          if (curlResult.exitCode !== 0) {
            throw new Error(`Failed to download FAL video ${i + 1}: ${curlResult.stderr}`);
          }
          
          console.log(`[step2] ✓ Downloaded FAL-animated video as video${i}.mp4`);
          
          if (i === 0) {
            // Copy first video to reelful directory
            await sandbox.commands.run(`cp "/home/user/public/media/video${i}.mp4" "/home/user/public/reelful/video_2025-10-10_18-12-33%20(2).mp4"`);
          }
        }
        console.log(`[step2] ✓ All ${project.videoUrls.length} FAL-animated videos downloaded`);
      } else {
        console.log("[step2] No FAL-animated videos to download");
      }

      return { success: true };
    } catch (error) {
      console.error("[step2] error:", error);
      await ctx.runMutation(api.tasks.updateRenderStep, {
        id: projectId,
        step: "failed",
        error: error instanceof Error ? error.message : "file upload failed",
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "file upload failed",
      };
    }
  },
});

export const step3RunVideoEditor = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }): Promise<{ success: boolean; output?: string; error?: string }> => {
    console.log("[step3] running video editor for project:", projectId);
    
    try {
      await ctx.runMutation(api.tasks.updateRenderStep, {
        id: projectId,
        step: "editing_sequence",
      });

      const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
      if (!project) throw new Error("project not found");
      if (!project.sandboxId) throw new Error("sandbox not found");
      
      // Ensure SRT content exists (should have been generated with voice and uploaded in step2)
      if (!project.srtContent || project.srtContent.trim().length === 0) {
        throw new Error("SRT content not found - please ensure voice generation completed successfully before running video editor");
      }

      const sandbox = await Sandbox.connect(project.sandboxId, { timeoutMs: 3600000 });

      const videoEditorPrompt = prompts.videoEditor.generateSimplified(project.prompt || 'create an engaging social media video');

      const promptBase64 = Buffer.from(videoEditorPrompt).toString('base64');
      await sandbox.commands.run(`echo '${promptBase64}' | base64 -d > /home/user/prompt.txt`);
      
      const claudeResult = await sandbox.commands.run(`bun run claude-agent.ts`, {
        cwd: "/home/user",
        timeoutMs: 600000,
        requestTimeoutMs: 600000,
      });
      
      if (claudeResult.exitCode !== 0) {
        throw new Error(`claude editing failed: ${claudeResult.stderr}`);
      }

      return { success: true, output: claudeResult.stdout };
    } catch (error) {
      console.error("[step3] error:", error);
      await ctx.runMutation(api.tasks.updateRenderStep, {
        id: projectId,
        step: "failed",
        error: error instanceof Error ? error.message : "video editing failed",
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "video editing failed",
      };
    }
  },
});

export const step4RenderSequence = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }): Promise<{ success: boolean; output?: string; error?: string }> => {
    console.log("[step4] rendering sequence for project:", projectId);
    
    try {
      await ctx.runMutation(api.tasks.updateRenderStep, {
        id: projectId,
        step: "rendering_video",
      });

      const project = await ctx.runQuery(api.tasks.getProject, { id: projectId });
      if (!project) throw new Error("project not found");
      if (!project.sandboxId) throw new Error("sandbox not found");

      const sandbox = await Sandbox.connect(project.sandboxId, { timeoutMs: 3600000 });

      console.log("[step4] cleaning up disk space before render...");
      // Clean up temporary files and caches to free disk space
      await sandbox.commands.run(`
        rm -rf /tmp/* /var/tmp/* 2>/dev/null || true;
        rm -rf ~/.bun/install/cache/* 2>/dev/null || true;
        rm -rf ~/.cache/* 2>/dev/null || true;
        rm -rf /home/user/.cache/* 2>/dev/null || true;
        rm -rf /home/user/node_modules/.cache/* 2>/dev/null || true;
      `);
      
      const diskCheck = await sandbox.commands.run(`df -h /home/user`);
      console.log("[step4] disk usage after cleanup:", diskCheck.stdout);

      console.log("[step4] running bun remotion render...");
      const remotionResult = await sandbox.commands.run(`bun remotion render`, {
        cwd: "/home/user",
        timeoutMs: 3600000,
        requestTimeoutMs: 3600000,
      });

      if (remotionResult.exitCode !== 0) {
        throw new Error(`remotion render failed: ${remotionResult.stderr}`);
      }

      console.log("[step4] checking output video...");
      const videoPath = "/home/user/out/Main.mp4";
      const statResult = await sandbox.commands.run(`stat "${videoPath}" 2>&1`);
      if (statResult.exitCode !== 0) {
        throw new Error(`output video not found at ${videoPath}`);
      }
      
      const sizeResult = await sandbox.commands.run(`stat -f%z "${videoPath}" 2>/dev/null || stat -c%s "${videoPath}" 2>/dev/null`);
      const outputSize = parseInt(sizeResult.stdout.trim() || "0");
      
      if (outputSize < 1000) {
        throw new Error(`output video too small (${outputSize} bytes)`);
      }

      console.log("[step4] downloading video from sandbox...");
      const downloadUrl = await sandbox.downloadUrl(videoPath, { useSignatureExpiration: 300000 });
      const videoResponse = await fetch(downloadUrl);
      
      if (!videoResponse.ok) {
        throw new Error(`failed to download video: ${videoResponse.statusText}`);
      }
      
      const videoBuffer = await videoResponse.arrayBuffer();
      console.log("[step4] video downloaded, size:", videoBuffer.byteLength);

      console.log("[step4] uploading to convex storage...");
      const uploadUrl: string = await ctx.runMutation(api.tasks.generateUploadUrl, {});
      const uploadResponse: Response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "video/mp4" },
        body: videoBuffer,
      });
      const { storageId }: { storageId: Id<"_storage"> } = await uploadResponse.json();
      const renderedVideoUrl: string | null = await ctx.storage.getUrl(storageId);
      
      console.log("[step4] updating project with rendered video url...");
      await ctx.runMutation(api.tasks.updateProjectWithRenderResult, {
        id: projectId,
        renderedVideoUrl: renderedVideoUrl || undefined,
        status: "completed",
      });

      await ctx.runMutation(api.tasks.updateRenderStep, {
        id: projectId,
        step: "completed",
      });

      return { success: true, output: remotionResult.stdout };
    } catch (error) {
      console.error("[step4] error:", error);
      await ctx.runMutation(api.tasks.updateRenderStep, {
        id: projectId,
        step: "failed",
        error: error instanceof Error ? error.message : "render failed",
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "render failed",
      };
    }
  },
});

export const getSandboxPreviewUrl = action({
  args: {
    sandboxId: v.string(),
    port: v.optional(v.number()),
  },
  handler: async (ctx, { sandboxId, port = 3000 }) => {
    try {
      if (!process.env.E2B_API_KEY) {
        throw new Error("E2B_API_KEY not set");
      }

      const sandbox = await Sandbox.connect(sandboxId, {
        timeoutMs: 30000,
      });

      let previewUrl = sandbox.getHost(port);
      
      // Ensure the URL has a protocol (https://)
      if (previewUrl && !previewUrl.startsWith('http://') && !previewUrl.startsWith('https://')) {
        previewUrl = `https://${previewUrl}`;
      }
      
      console.log("[getSandboxPreviewUrl] preview url for port", port, ":", previewUrl);

      return {
        success: true,
        previewUrl,
        port,
      };
    } catch (error) {
      console.error("[getSandboxPreviewUrl] error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "failed to get preview url",
      };
    }
  },
});

export const startDevServer = action({
  args: {
    sandboxId: v.string(),
    command: v.optional(v.string()),
    workDir: v.optional(v.string()),
  },
  handler: async (ctx, { sandboxId, command = "bun run dev", workDir = "/home/user" }) => {
    try {
      if (!process.env.E2B_API_KEY) {
        throw new Error("E2B_API_KEY not set");
      }

      const sandbox = await Sandbox.connect(sandboxId, {
        timeoutMs: 30000,
      });

      console.log("[startDevServer] starting dev server with command:", command);
      
      // Start the dev server in background
      const commandHandle = await sandbox.commands.run(command, {
        background: true,
        cwd: workDir,
      });

      console.log("[startDevServer] dev server started with pid:", commandHandle.pid);

      return {
        success: true,
        pid: commandHandle.pid,
        message: `Dev server started with command: ${command}`,
      };
    } catch (error) {
      console.error("[startDevServer] error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "failed to start dev server",
      };
    }
  },
});

export const checkProcessStatus = action({
  args: {
    sandboxId: v.string(),
    processPattern: v.optional(v.string()),
  },
  handler: async (ctx, { sandboxId, processPattern = "bun" }) => {
    try {
      if (!process.env.E2B_API_KEY) {
        throw new Error("E2B_API_KEY not set");
      }

      const sandbox = await Sandbox.connect(sandboxId, {
        timeoutMs: 30000,
      });

      // Check if process is running
      const result = await sandbox.commands.run(`ps aux | grep "${processPattern}" | grep -v grep`);
      
      const isRunning = result.exitCode === 0 && result.stdout.trim().length > 0;
      
      return {
        success: true,
        isRunning,
        processes: result.stdout.trim(),
      };
    } catch (error) {
      console.error("[checkProcessStatus] error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "failed to check process status",
      };
    }
  },
});

export const stopDevServer = action({
  args: {
    sandboxId: v.string(),
    processPattern: v.optional(v.string()),
  },
  handler: async (ctx, { sandboxId, processPattern = "bun.*dev" }) => {
    try {
      if (!process.env.E2B_API_KEY) {
        throw new Error("E2B_API_KEY not set");
      }

      const sandbox = await Sandbox.connect(sandboxId, {
        timeoutMs: 30000,
      });

      console.log("[stopDevServer] stopping dev server matching pattern:", processPattern);
      
      // Kill processes matching the pattern
      await sandbox.commands.run(`pkill -f "${processPattern}"`);

      return {
        success: true,
        message: "Dev server stopped",
      };
    } catch (error) {
      console.error("[stopDevServer] error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "failed to stop dev server",
      };
    }
  },
});

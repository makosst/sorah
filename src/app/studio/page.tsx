"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import type { Id } from "../../../convex/_generated/dataModel";

type WorkflowStep = "input" | "script_review" | "generating" | "complete";

type FileWithPreview = {
  file: File;
  preview: string;
  isImage: boolean;
  isAnimating?: boolean;
};

export default function Studio() {
  const router = useRouter();
  const { userId, isInitialized } = useAuth();
  const currentUser = useQuery(api.users.getCurrentUser, userId ? { userId } : "skip");
  
  const [step, setStep] = useState<WorkflowStep>("input");
  const [description, setDescription] = useState("");
  const [filesWithPreview, setFilesWithPreview] = useState<FileWithPreview[]>([]);
  const [thumbnailIndex, setThumbnailIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [projectId, setProjectId] = useState<Id<"projects"> | null>(null);
  const [generatedScript, setGeneratedScript] = useState("");
  const [editingScript, setEditingScript] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const renderTriggeredRef = useRef(false);
  
  const generateUploadUrl = useMutation(api.tasks.generateUploadUrl);
  const createProject = useMutation(api.tasks.createProject);
  const generateScriptOnly = useAction(api.tasks.generateScriptOnly);
  const generateMediaAssets = useAction(api.tasks.generateMediaAssets);
  const updateProjectScript = useMutation(api.tasks.updateProjectScript);
  const markProjectSubmitted = useMutation(api.tasks.markProjectSubmitted);
  const renderVideo = useAction(api.render.renderVideo);
  
  const project = useQuery(
    api.tasks.getProject,
    projectId ? { id: projectId } : "skip"
  );

  // Redirect if not authenticated
  useEffect(() => {
    if (isInitialized && !userId) {
      router.push("/auth");
    } else if (currentUser && !currentUser.onboardingCompleted) {
      router.push("/onboarding");
    }
  }, [isInitialized, userId, currentUser, router]);

  // Monitor project progress
  useEffect(() => {
    if (!project) return;

    if (step === "input" && project.script) {
      // Replace ??? with ? for display
      setGeneratedScript(project.script.replace(/\?\?\?/g, "?"));
      setStep("script_review");
    }

    if (step === "generating") {
      if (project.status === "processing") {
        if (!project.script) {
          setGenerationProgress("Analyzing your media and generating script...");
        } else if (!project.audioUrl) {
          setGenerationProgress("Creating voiceover...");
        } else if (!project.musicUrl) {
          setGenerationProgress("Generating background music...");
        } else if (!project.videoUrls || project.videoUrls.length === 0) {
          setGenerationProgress("Animating images...");
        } else {
          setGenerationProgress("Processing media files...");
        }
      } else if (project.status === "rendering") {
        if (project.renderProgress) {
          setGenerationProgress(`Rendering video: ${project.renderProgress.step}`);
        } else {
          setGenerationProgress("Rendering your final video...");
        }
      } else if (project.status === "completed" && project.renderedVideoUrl) {
        setStep("complete");
      } else if (project.status === "failed") {
        setGenerationProgress(`Error: ${project.error || "Something went wrong"}`);
      }
    }
  }, [project, step]);

  // Auto-trigger render when ALL media assets are ready
  useEffect(() => {
    console.log("[studio] useEffect triggered - project:", project?._id, "step:", step);
    
    if (!project || !projectId || step !== "generating") {
      console.log("[studio] Skipping render check:", {
        hasProject: !!project,
        hasProjectId: !!projectId,
        step: step,
        shouldBeGenerating: step === "generating"
      });
      return;
    }
    
    // Check if all required media assets are ready
    // Note: videoUrls are optional if user uploaded videos instead of images
    const hasAllMediaAssets = !!(
      project.audioUrl && 
      project.musicUrl
    );
    
    // Log what we're checking
    const hasAnimations = !!(project.videoUrls && project.videoUrls.length > 0);
    console.log("[studio] Asset check:", {
      hasAudio: !!project.audioUrl,
      hasMusic: !!project.musicUrl,
      hasAnimations,
      animationCount: project.videoUrls?.length || 0
    });
    
    console.log("[studio] Render check conditions:", {
      status: project.status,
      hasAllMediaAssets,
      audioUrl: project.audioUrl ? "✓" : "✗",
      musicUrl: project.musicUrl ? "✓" : "✗",
      videoUrlsCount: project.videoUrls?.length || 0,
      hasRenderedVideoUrl: !!project.renderedVideoUrl,
      hasRenderProgress: !!project.renderProgress,
      renderTriggered: renderTriggeredRef.current
    });
    
    // Only trigger render when status is completed AND all media assets exist
    if (
      project.status === "completed" && 
      hasAllMediaAssets &&
      !project.renderedVideoUrl && 
      !project.renderProgress && 
      !renderTriggeredRef.current
    ) {
      console.log("[studio] ✅ All media assets ready! Triggering render...");
      console.log("[studio]   - audioUrl:", project.audioUrl ? "✓" : "✗");
      console.log("[studio]   - musicUrl:", project.musicUrl ? "✓" : "✗");
      console.log("[studio]   - videoUrls:", project.videoUrls?.length || 0, "videos");
      
      renderTriggeredRef.current = true;
      setGenerationProgress("Starting video render...");
      
      renderVideo({ projectId }).catch((error) => {
        console.error("[studio] render error:", error);
        setGenerationProgress(`Render error: ${error}`);
        renderTriggeredRef.current = false; // Reset on error so user can retry
      });
    } else if (project.status === "completed" && !hasAllMediaAssets && !renderTriggeredRef.current) {
      console.log("[studio] ⏳ Waiting for all media assets...");
      console.log("[studio]   - audioUrl:", project.audioUrl ? "✓" : "✗");
      console.log("[studio]   - musicUrl:", project.musicUrl ? "✓" : "✗");
      console.log("[studio]   - videoUrls:", project.videoUrls?.length || 0, "videos");
    }
  }, [project, projectId, step, renderVideo]);

  // Live timer during generation
  useEffect(() => {
    if (step === "generating" && project?.submittedAt) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - project.submittedAt) / 1000);
        setElapsedSeconds(elapsed);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsedSeconds(0);
    }
  }, [step, project?.submittedAt]);

  // Simulate animation for images
  useEffect(() => {
    if (filesWithPreview.length > 0) {
      const imageFiles = filesWithPreview.filter(f => f.isImage);
      imageFiles.forEach((_, index) => {
        setTimeout(() => {
          setFilesWithPreview(prev => 
            prev.map((f, i) => {
              if (f.isImage && imageFiles.findIndex(img => img.preview === f.preview) === index) {
                return { ...f, isAnimating: true };
              }
              return f;
            })
          );
        }, 1000 + index * 500);
      });
    }
  }, [filesWithPreview.length]);

  // Show loading while checking auth
  if (!isInitialized || !userId || currentUser === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser?.onboardingCompleted) {
    return null;
  }

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const filesWithPreviews = selectedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      isImage: file.type.startsWith('image/'),
      isAnimating: false,
    }));
    setFilesWithPreview(filesWithPreviews);
  };

  const handleUploadAndGenerateScript = async () => {
    if (!description.trim() || filesWithPreview.length === 0) return;
    
    setUploading(true);
    
    try {
      // Upload files
      const fileIds = [];
      const fileMetadata = [];
      for (const { file } of filesWithPreview) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await result.json();
        fileIds.push(storageId);
        fileMetadata.push({
          storageId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        });
      }

      // Determine thumbnail
      const imageFiles = filesWithPreview.map((f, i) => ({ file: f, index: i })).filter(f => f.file.isImage);
      const thumbnailFileIndex = thumbnailIndex !== null 
        ? thumbnailIndex 
        : imageFiles.length > 0 
          ? imageFiles[0].index 
          : 0;
      
      // Create project
      const newProjectId = await createProject({ 
        userId,
        prompt: description, 
        files: fileIds,
        fileMetadata,
        thumbnail: fileIds[thumbnailFileIndex],
      });
      
      setProjectId(newProjectId);
      
      // Start script generation only (Phase 1)
      console.log("[studio] Starting script generation for project:", newProjectId);
      generateScriptOnly({
        projectId: newProjectId,
      }).catch((error) => {
        console.error("script generation error:", error);
      });
      
      setUploading(false);
    } catch (error) {
      console.error("upload error:", error);
      alert(`upload failed: ${error}`);
      setUploading(false);
    }
  };

  const handleScriptApproved = async () => {
    if (!projectId) return;
    
    // Save edited script if needed
    if (editingScript && generatedScript !== project?.script) {
      console.log("[studio] Saving edited script...");
      // Replace ? with ??? before saving (but not if it's already ???)
      const scriptToSave = generatedScript.replace(/\?(?!\?\?)/g, "???");
      await updateProjectScript({ id: projectId, script: scriptToSave });
    }
    
    // Mark submission timestamp for timing
    await markProjectSubmitted({ id: projectId });
    
    setStep("generating");
    setGenerationProgress("Generating voiceover and music from your script...");
    
    // Start media generation (Phase 2: voice, music, animations)
    console.log("[studio] Starting media asset generation for project:", projectId);
    generateMediaAssets({
      projectId: projectId,
    }).catch((error) => {
      console.error("media generation error:", error);
      setGenerationProgress(`Error: ${error}`);
    });
  };

  const handleStartOver = () => {
    setStep("input");
    setDescription("");
    setFilesWithPreview([]);
    setThumbnailIndex(null);
    setProjectId(null);
    setGeneratedScript("");
    setEditingScript(false);
    setGenerationProgress("");
    renderTriggeredRef.current = false; // Reset render flag
  };

  // INPUT STEP
  if (step === "input") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex items-center justify-between mb-8">
            <Link href="/" className="text-purple-600 hover:text-purple-700">
              ← back
            </Link>
            <Link href="/settings" className="text-purple-600 hover:text-purple-700">
              settings
            </Link>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              create your video
            </h1>
            <p className="text-gray-600 mb-8">describe your idea and upload your media</p>

            <div className="space-y-6">
              {/* Description Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  what's your video about?
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., A travel vlog about my trip to Japan, showcasing beautiful temples and cherry blossoms..."
                  className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none h-32"
                  disabled={uploading}
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  add your media {filesWithPreview.length > 0 && `(${filesWithPreview.length})`}
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-500 transition-colors">
                  <input
                    type="file"
                    onChange={handleFileSelection}
                    multiple
                    accept="image/*,video/*"
                    className="hidden"
                    id="file-upload"
                    disabled={uploading}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="text-4xl mb-2">📁</div>
                    <p className="text-gray-600">
                      {filesWithPreview.length > 0 ? `${filesWithPreview.length} files selected` : "click to upload photos and videos"}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">images will be automatically animated</p>
                  </label>
                </div>

                {/* Media Preview Grid */}
                {filesWithPreview.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-600 mb-2">
                      {thumbnailIndex === null 
                        ? 'auto-selected thumbnail: first image (click to change)' 
                        : 'click to select thumbnail'}
                    </p>
                    <div className="grid grid-cols-4 gap-3">
                      {filesWithPreview.map((fileWithPreview, i) => {
                        const imageFiles = filesWithPreview.filter(f => f.isImage);
                        const autoThumbnailIndex = imageFiles.length > 0 
                          ? filesWithPreview.findIndex(f => f.preview === imageFiles[0].preview) 
                          : 0;
                        const isSelected = thumbnailIndex !== null ? thumbnailIndex === i : autoThumbnailIndex === i;
                        
                        return (
                          <div 
                            key={i} 
                            onClick={() => setThumbnailIndex(i)}
                            className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-all ${
                              isSelected 
                                ? 'ring-4 ring-purple-500 scale-105' 
                                : 'ring-1 ring-gray-200 hover:ring-purple-300'
                            }`}
                          >
                            {fileWithPreview.isImage ? (
                              <>
                                <Image
                                  src={fileWithPreview.preview}
                                  alt={fileWithPreview.file.name}
                                  fill
                                  className="object-cover"
                                />
                                {fileWithPreview.isAnimating && (
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <div className="text-white text-center">
                                      <div className="text-2xl mb-1">✨</div>
                                      <div className="text-xs font-medium">animating...</div>
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                <div className="text-white text-center">
                                  <div className="text-2xl">🎥</div>
                                  <div className="text-xs mt-1">video</div>
                                </div>
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute top-1 right-1 bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
                                thumb
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Continue Button */}
              <button
                onClick={handleUploadAndGenerateScript}
                disabled={uploading || !description.trim() || filesWithPreview.length === 0}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {uploading ? "uploading and generating script..." : "continue →"}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // SCRIPT REVIEW STEP
  if (step === "script_review") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              review your script
            </h1>
            <p className="text-gray-600 mb-8">verify or edit the generated script for your video</p>

            <div className="space-y-6">
              {/* Original Description */}
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-sm font-medium text-purple-900 mb-2">your description:</p>
                <p className="text-gray-700">{description}</p>
              </div>

              {/* Generated Script */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    generated script
                  </label>
                  <button
                    onClick={() => setEditingScript(!editingScript)}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    {editingScript ? "preview" : "edit"}
                  </button>
                </div>
                {editingScript ? (
                  <textarea
                    value={generatedScript}
                    onChange={(e) => setGeneratedScript(e.target.value)}
                    className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none h-48"
                  />
                ) : (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {generatedScript.replace(/\?\?\?/g, "?")}
                    </p>
                  </div>
                )}
              </div>

              {/* Media Preview */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">your media</p>
                <div className="grid grid-cols-6 gap-2">
                  {filesWithPreview.map((fileWithPreview, i) => (
                    <div 
                      key={i} 
                      className="relative aspect-square rounded-lg overflow-hidden"
                    >
                      {fileWithPreview.isImage ? (
                        <Image
                          src={fileWithPreview.preview}
                          alt={fileWithPreview.file.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                          <div className="text-white text-xl">🎥</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={handleStartOver}
                  className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all"
                >
                  start over
                </button>
                <button
                  onClick={handleScriptApproved}
                  className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all hover:scale-105"
                >
                  generate video ✨
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Helper function to format seconds
  const formatSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // GENERATING STEP
  if (step === "generating") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-6">
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="w-24 h-24 border-8 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-8"></div>
            
            <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              creating your video
            </h1>
            
            {elapsedSeconds > 0 && (
              <div className="mb-4">
                <p className="text-2xl font-bold text-purple-600">
                  ⏱️ {formatSeconds(elapsedSeconds)}
                </p>
              </div>
            )}
            
            <p className="text-gray-600 text-lg mb-8">
              {generationProgress || "Preparing..."}
            </p>

            <div className="space-y-3 text-left max-w-md mx-auto">
              <div className={`flex items-center gap-3 p-3 rounded-lg ${project?.script ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className="text-xl">{project?.script ? '✓' : '⏳'}</div>
                <span className="text-sm text-gray-700">Script generated</span>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-lg ${project?.audioUrl ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className="text-xl">{project?.audioUrl ? '✓' : '⏳'}</div>
                <span className="text-sm text-gray-700">Voiceover created</span>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-lg ${project?.musicUrl ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className="text-xl">{project?.musicUrl ? '✓' : '⏳'}</div>
                <span className="text-sm text-gray-700">Music generated</span>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-lg ${project?.videoUrls && project.videoUrls.length > 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className="text-xl">{project?.videoUrls && project.videoUrls.length > 0 ? '✓' : '⏳'}</div>
                <span className="text-sm text-gray-700">Images animated</span>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-lg ${project?.renderedVideoUrl ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className="text-xl">{project?.renderedVideoUrl ? '✓' : '⏳'}</div>
                <span className="text-sm text-gray-700">Video rendered</span>
              </div>
            </div>

            {project?.status === "failed" && (
              <div className="mt-8">
                <button
                  onClick={handleStartOver}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  try again
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  // Helper function to format elapsed time
  const formatElapsedTime = (startTime: number, endTime: number) => {
    const elapsedMs = endTime - startTime;
    const seconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // COMPLETE STEP
  if (step === "complete") {
    const elapsedTime = project?.submittedAt && project?.completedAt 
      ? formatElapsedTime(project.submittedAt, project.completedAt)
      : null;

    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🎉</div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                your video is ready!
              </h1>
              <p className="text-gray-600">download and share your creation</p>
              {elapsedTime && (
                <div className="mt-4 inline-block px-4 py-2 bg-purple-100 rounded-full">
                  <p className="text-sm text-purple-800">
                    ⏱️ generated in <span className="font-bold">{elapsedTime}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Video Player */}
            {project?.renderedVideoUrl && (
              <div className="mb-8">
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    src={project.renderedVideoUrl}
                    controls
                    className="w-full h-full"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            )}

            {/* Download Button */}
            <div className="space-y-4">
              {project?.renderedVideoUrl && (
                <a
                  href={project.renderedVideoUrl}
                  download="video.mp4"
                  className="flex items-center justify-center gap-3 w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all hover:scale-105"
                >
                  <span className="text-2xl">⬇</span>
                  download video
                </a>
              )}

              <div className="flex gap-4">
                <Link
                  href="/"
                  className="flex-1 text-center py-4 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all"
                >
                  go home
                </Link>
                <button
                  onClick={handleStartOver}
                  className="flex-1 py-4 bg-purple-100 text-purple-700 rounded-lg font-semibold hover:bg-purple-200 transition-all"
                >
                  create another
                </button>
              </div>
            </div>

            {/* Project Details */}
            {projectId && (
              <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 text-center">
                  need more control?{" "}
                  <Link
                    href={`/project/${projectId}`}
                    className="text-purple-600 hover:text-purple-700 font-medium"
                  >
                    view advanced project page →
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  return null;
}


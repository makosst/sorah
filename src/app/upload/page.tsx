"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function Upload() {
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [thumbnailIndex, setThumbnailIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();
  const { userId, isInitialized } = useAuth();
  const currentUser = useQuery(api.users.getCurrentUser, userId ? { userId } : "skip");
  
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const generateUploadUrl = useMutation(api.tasks.generateUploadUrl);
  const createProject = useMutation(api.tasks.createProject);
  const processProjectWithAI = useAction(api.tasks.processProjectWithAI);

  // Redirect if not authenticated
  useEffect(() => {
    if (isInitialized && !userId) {
      router.push("/auth");
    } else if (currentUser && !currentUser.onboardingCompleted) {
      router.push("/onboarding");
    }
  }, [isInitialized, userId, currentUser, router]);

  // Show loading while checking auth
  if (!isInitialized || !userId || currentUser === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
    setFiles(selectedFiles);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    
    try {
      console.log("uploading files:", files.length);
      
      const fileIds = [];
      const fileMetadata = [];
      for (const file of files) {
        console.log("uploading:", file.name, file.size);
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await result.json();
        console.log("uploaded:", storageId);
        fileIds.push(storageId);
        fileMetadata.push({
          storageId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        });
      }

      console.log("creating project with", fileIds.length, "files");
      
      const imageFiles = files.map((f, i) => ({ file: f, index: i })).filter(f => f.file.type.startsWith('image/'));
      const thumbnailFileIndex = thumbnailIndex !== null 
        ? thumbnailIndex 
        : imageFiles.length > 0 
          ? imageFiles[0].index 
          : 0;
      
      const newProjectId = await createProject({ 
        userId,
        prompt, 
        files: fileIds,
        fileMetadata,
        thumbnail: fileIds[thumbnailFileIndex],
      });
      console.log("created project:", newProjectId);

      console.log("triggering ai processing...");
      processProjectWithAI({
        projectId: newProjectId,
      }).catch((error) => {
        console.error("ai processing error:", error);
      });
      
      router.push(`/project/${newProjectId}`);
    } catch (error) {
      console.error("upload error:", error);
      alert(`upload failed: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-purple-600 hover:text-purple-700 mb-8 inline-block">
          ← back
        </Link>
        
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            create project
          </h1>
          <p className="text-gray-600 mb-2">upload images and videos, describe your idea</p>
          <p className="text-sm text-gray-500 mb-8">ai will generate script, voiceover, and music for your content</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="describe your video idea..."
                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none h-32"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                files {files.length > 0 && `(${files.length})`}
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-500 transition-colors">
                <input
                  type="file"
                  onChange={handleFileSelection}
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  id="file-upload"
                  required
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="text-4xl mb-2">📁</div>
                  <p className="text-gray-600">
                    {files.length > 0 ? `${files.length} files selected` : "click to upload files"}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">5-10 videos or photos</p>
                </label>
              </div>

              {files.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-gray-600 mb-2">
                    {thumbnailIndex === null 
                      ? 'auto-selected: first image (or click to choose thumbnail)' 
                      : 'click to select thumbnail'}
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {files.map((file, i) => {
                      const imageFiles = files.map((f, idx) => ({ file: f, index: idx })).filter(f => f.file.type.startsWith('image/'));
                      const autoThumbnailIndex = imageFiles.length > 0 ? imageFiles[0].index : 0;
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
                          <Image
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            fill
                            className="object-cover"
                          />
                          {isSelected && (
                            <div className="absolute top-1 right-1 bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
                              thumbnail
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {uploading ? "uploading..." : "create project"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

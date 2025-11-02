"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { HeroSection } from "@/components/ui/hero-section-dark";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { userId, signOut, isInitialized } = useAuth();
  const projects = useQuery(api.tasks.getProjects, userId ? { userId } : "skip");
  const currentUser = useQuery(api.users.getCurrentUser, userId ? { userId } : "skip");
  const simulateCompleted = useMutation(api.tasks.simulateCompleted);
  const deleteProject = useMutation(api.tasks.deleteProject);
  const renderVideo = useAction(api.render.renderVideo);
  const router = useRouter();
  const [renderingIds, setRenderingIds] = useState<Set<string>>(new Set());

  // Redirect to auth if not logged in
  useEffect(() => {
    if (isInitialized && !userId) {
      router.push("/auth");
    } else if (currentUser && !currentUser.onboardingCompleted) {
      router.push("/onboarding");
    }
  }, [isInitialized, userId, currentUser, router]);

  // Show loading state while checking auth
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

  // Don't show content if redirecting
  if (!currentUser || !currentUser.onboardingCompleted) {
    return null;
  }

  return (
    <main className="min-h-screen">
      {/* User Profile Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
              {currentUser.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <p className="font-medium text-gray-900">{currentUser.name || "User"}</p>
              <p className="text-sm text-gray-500 capitalize">{currentUser.preferredStyle || "no style"} style</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/settings")}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              settings
            </button>
            <button
              onClick={() => signOut()}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              sign out
            </button>
          </div>
        </div>
      </div>

      <HeroSection
        title="turn your videos into magic"
        subtitle={{
          regular: "create stunning video content with ",
          gradient: "ai-powered editing",
        }}
        description="upload your raw footage and let our ai transform it into polished, professional videos in minutes"
        ctaText="create project"
        ctaHref="/upload"
        bottomImage={{
          light: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1200&h=675&fit=crop",
          dark: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1200&h=675&fit=crop",
        }}
        gridOptions={{
          angle: 65,
          opacity: 0.4,
          cellSize: 50,
          lightLineColor: "#9333ea",
          darkLineColor: "#7c3aed",
        }}
      />

      {/* Create Options */}
      <div className="max-w-6xl mx-auto px-6 -mt-8 mb-8">
        <div className="grid md:grid-cols-2 gap-6">
          <button
            onClick={() => router.push("/studio")}
            className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-purple-200 hover:border-purple-400 text-left group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl flex items-center justify-center text-white text-2xl">
                ✨
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                  studio (new!)
                </h3>
                <p className="text-sm text-gray-500">streamlined experience</p>
              </div>
            </div>
            <p className="text-gray-600">
              Simple workflow: add media, review script, and generate your video with one click
            </p>
          </button>

          <button
            onClick={() => router.push("/upload")}
            className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-gray-200 hover:border-gray-400 text-left group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center text-white text-2xl">
                🎬
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-gray-700 transition-colors">
                  advanced
                </h3>
                <p className="text-sm text-gray-500">full control</p>
              </div>
            </div>
            <p className="text-gray-600">
              Complete control with tabs for media, script editing, preview, and sandbox management
            </p>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">
        {projects && projects.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">projects</h2>
            <div className="grid gap-4">
              {projects.map((project) => (
                <div key={project._id} onClick={() => router.push(`/project/${project._id}`)} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start gap-4 mb-4">
                    {project.thumbnailUrl && (
                      <div className="relative w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200">
                        <Image
                          src={project.thumbnailUrl}
                          alt="project thumbnail"
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-gray-800 mb-2">{project.prompt}</p>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span>{project.files.length} files</span>
                        <span>•</span>
                        <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className={`mt-2 inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        project.status === "completed" 
                          ? "bg-green-100 text-green-700"
                          : project.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {project.status || "processing"}
                      </div>
                    </div>
                  </div>

                  {project.script && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 mb-2">script</p>
                      <p className="text-sm text-gray-600">{project.script}</p>
                    </div>
                  )}

                  {(project.audioUrl || project.musicUrl || project.videoUrls) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {project.audioUrl && (
                        <a 
                          href={project.audioUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200 transition-colors"
                        >
                          audio
                        </a>
                      )}
                      {project.musicUrl && (
                        <a 
                          href={project.musicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 transition-colors"
                        >
                          music
                        </a>
                      )}
                      {project.videoUrls?.map((url, i) => (
                        <a 
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1 bg-pink-100 text-pink-700 rounded-lg text-sm hover:bg-pink-200 transition-colors"
                        >
                          video {i + 1}
                        </a>
                      ))}
                    </div>
                  )}

                  {project.error && (
                    <div className="mt-4 p-4 bg-red-50 rounded-lg">
                      <p className="text-sm font-medium text-red-700 mb-1">error</p>
                      <p className="text-sm text-red-600">{project.error}</p>
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    {(project.status === "completed" || project.status === "failed" || project.status === "rendering") && !project.renderedVideoUrl && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          setRenderingIds(prev => new Set(prev).add(project._id));
                          try {
                            await renderVideo({ projectId: project._id });
                          } catch (error) {
                            console.error("render error:", error);
                          } finally {
                            setRenderingIds(prev => {
                              const next = new Set(prev);
                              next.delete(project._id);
                              return next;
                            });
                          }
                        }}
                        disabled={renderingIds.has(project._id)}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm hover:shadow-lg transition-all disabled:opacity-50"
                      >
                        {renderingIds.has(project._id) ? "rendering..." : project.status === "rendering" ? "restart render" : project.status === "failed" ? "retry render" : "render video"}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        simulateCompleted({ id: project._id });
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                    >
                      simulate completed
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProject({ id: project._id });
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                    >
                      delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

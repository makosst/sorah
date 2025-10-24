"use client";

import { use, useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import Link from "next/link";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import Tabs from "@/components/Tabs";

import { MediaTabContent } from "./MediaTabContent";
import { SandboxTabContent } from "./SandboxTabContent";
import { ScriptTabContent } from "./ScriptTabContent";
import { PreviewTabContent } from "./PreviewTabContent";
import type { ProjectDoc } from "./types";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  // Validate that the ID is a valid Convex ID (starts with a letter and contains only alphanumeric chars)
  const isValidConvexId = /^[a-z][a-z0-9]{7,}$/.test(id);
  
  if (!isValidConvexId) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <Link href="/" className="text-purple-600 hover:text-purple-700 mb-8 inline-block">
            ← back to home
          </Link>
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">invalid project id</h1>
            <p className="text-gray-600 mb-4">
              the project id &quot;{id}&quot; is not valid
            </p>
            <Link
              href="/"
              className="inline-block px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all"
            >
              go to home
            </Link>
          </div>
        </div>
      </main>
    );
  }
  
  const projectId = id as Id<"projects">;
  const project = useQuery(api.tasks.getProject, { id: projectId }) as ProjectDoc | undefined;
  const renderVideo = useAction(api.render.renderVideo);
  const [rendering, setRendering] = useState(false);

  // Reset rendering state based on project status
  useEffect(() => {
    if (project?.status === "rendering") {
      setRendering(true);
    } else if (project?.status === "completed" || project?.status === "failed") {
      setRendering(false);
    }
  }, [project?.status]);

  if (!project) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="text-center">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-gray-600">loading project...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <Link href="/" className="text-purple-600 hover:text-purple-700 mb-8 inline-block">
          ← back to home
        </Link>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              project status
            </h1>
            <div className="flex items-center gap-3">
              <div
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  project.status === "completed"
                    ? "bg-green-100 text-green-700"
                    : project.status === "failed"
                    ? "bg-red-100 text-red-700"
                    : project.status === "rendering"
                    ? "bg-blue-100 text-blue-700 animate-pulse"
                    : "bg-yellow-100 text-yellow-700 animate-pulse"
                }`}
              >
                {project.status || "processing"}
              </div>
              {(project.status === "completed" ||
                project.status === "failed" ||
                project.status === "rendering") && (
                <button
                  onClick={() => {
                    // Fire and forget - don't await the render
                    // The UI will update automatically via reactive queries
                    renderVideo({ projectId }).catch((error) => {
                      console.error("render error:", error);
                    });
                    setRendering(true);
                  }}
                  disabled={rendering || project.status === "rendering"}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {project.status === "rendering"
                    ? "rendering in progress..."
                    : rendering
                    ? "starting render..."
                    : project.renderedVideoUrl
                    ? "re-render"
                    : project.status === "failed"
                    ? "retry render"
                    : "render video"}
                </button>
              )}
            </div>
          </div>

          <div className="mt-6">
            <Tabs
              defaultTab="media"
              tabs={[
                {
                  id: "media",
                  label: "Media",
                  content: <MediaTabContent project={project} projectId={projectId} />,
                },
                {
                  id: "script",
                  label: "Script",
                  content: <ScriptTabContent project={project} projectId={projectId} />,
                },
                {
                  id: "preview",
                  label: "Preview",
                  content: <PreviewTabContent project={project} projectId={projectId} />,
                },
                {
                  id: "sandbox",
                  label: "Sandbox State",
                  content: <SandboxTabContent project={project} projectId={projectId} />,
                },
              ]}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

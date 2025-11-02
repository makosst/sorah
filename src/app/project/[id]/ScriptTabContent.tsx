"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

import type { ProjectDoc } from "./types";

type ScriptTabContentProps = {
  project: ProjectDoc;
  projectId: Id<"projects">;
};

export function ScriptTabContent({ project, projectId }: ScriptTabContentProps) {
  const regenerateScript = useAction(api.tasks.regenerateScript);
  const regenerateVoiceover = useAction(api.tasks.regenerateVoiceover);
  const regenerateMusic = useAction(api.tasks.regenerateMusic);
  const regenerateAnimations = useAction(api.tasks.regenerateAnimations);
  const updateProjectScript = useMutation(api.tasks.updateProjectScript);

  const [regeneratingScript, setRegeneratingScript] = useState(false);
  const [regeneratingVoiceover, setRegeneratingVoiceover] = useState(false);
  const [regeneratingMusic, setRegeneratingMusic] = useState(false);
  const [regeneratingAnimations, setRegeneratingAnimations] = useState(false);
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [scriptDraft, setScriptDraft] = useState(project.script ?? "");
  const [savingScript, setSavingScript] = useState(false);
  const [saveScriptError, setSaveScriptError] = useState<string | null>(null);

  useEffect(() => {
    if (isEditingScript) return;
    // Replace ??? with ? for display
    setScriptDraft((project.script ?? "").replace(/\?\?\?/g, "?"));
  }, [project.script, isEditingScript]);

  const handleSaveScript = async () => {
    if (!project?._id) return;
    if (!scriptDraft.trim()) {
      setSaveScriptError("script cannot be empty");
      return;
    }

    setSavingScript(true);
    setSaveScriptError(null);
    try {
      // Replace ? with ??? before saving (but not if it's already ???)
      const scriptToSave = scriptDraft.replace(/\?(?!\?\?)/g, "???");
      await updateProjectScript({ id: projectId, script: scriptToSave });
      setIsEditingScript(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed to save script";
      setSaveScriptError(message);
    } finally {
      setSavingScript(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">prompt</p>
        <p className="text-gray-800 p-4 bg-gray-50 rounded-lg">{project.prompt}</p>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">created</p>
        <p className="text-gray-600 text-sm">{new Date(project.createdAt).toLocaleString()}</p>
      </div>

      <div className="border-t pt-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">processing stages</h2>

        <div className="space-y-3">
          <div className={`flex items-center gap-3 p-4 rounded-lg ${project.status ? "bg-green-50" : "bg-gray-50"}`}>
            <div className={`text-2xl ${project.status ? "opacity-100" : "opacity-30"}`}>
              {project.status ? "✓" : "○"}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">1. upload files</p>
              <p className="text-sm text-gray-600">files uploaded and stored</p>
            </div>
          </div>

          <div
            className={`flex items-center gap-3 p-4 rounded-lg ${
              project.script
                ? "bg-green-50"
                : project.status === "processing"
                ? "bg-yellow-50 animate-pulse"
                : "bg-gray-50"
            }`}
          >
            <div className={`text-2xl ${project.script ? "opacity-100" : "opacity-30"}`}>
              {project.script ? "✓" : project.status === "processing" ? "⏳" : "○"}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">2. generate script</p>
              <p className="text-sm text-gray-600">creating 15-second social media script</p>
            </div>
            {(project.script || project.status === "failed") && (
              <button
                onClick={async () => {
                  setRegeneratingScript(true);
                  try {
                    await regenerateScript({ projectId });
                  } finally {
                    setRegeneratingScript(false);
                  }
                }}
                disabled={regeneratingScript}
                className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
              >
                {regeneratingScript ? "..." : project.script ? "regenerate" : "start"}
              </button>
            )}
          </div>

          <div
            className={`flex items-center gap-3 p-4 rounded-lg ${
              project.audioUrl
                ? "bg-green-50"
                : project.script
                ? "bg-yellow-50 animate-pulse"
                : "bg-gray-50"
            }`}
          >
            <div className={`text-2xl ${project.audioUrl ? "opacity-100" : "opacity-30"}`}>
              {project.audioUrl ? "✓" : project.script ? "⏳" : "○"}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">3. generate voiceover</p>
              <p className="text-sm text-gray-600">converting script to speech with elevenlabs</p>
            </div>
            {(project.audioUrl || (project.script && project.status === "failed")) && (
              <button
                onClick={async () => {
                  setRegeneratingVoiceover(true);
                  try {
                    await regenerateVoiceover({ projectId });
                  } finally {
                    setRegeneratingVoiceover(false);
                  }
                }}
                disabled={regeneratingVoiceover}
                className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
              >
                {regeneratingVoiceover ? "..." : project.audioUrl ? "regenerate" : "start"}
              </button>
            )}
          </div>

          <div
            className={`flex items-center gap-3 p-4 rounded-lg ${
              project.musicUrl
                ? "bg-green-50"
                : project.audioUrl
                ? "bg-yellow-50 animate-pulse"
                : "bg-gray-50"
            }`}
          >
            <div className={`text-2xl ${project.musicUrl ? "opacity-100" : "opacity-30"}`}>
              {project.musicUrl ? "✓" : project.audioUrl ? "⏳" : "○"}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">4. generate background music</p>
              <p className="text-sm text-gray-600">creating matching background track</p>
            </div>
            {(project.musicUrl || (project.audioUrl && project.status === "failed")) && (
              <button
                onClick={async () => {
                  setRegeneratingMusic(true);
                  try {
                    await regenerateMusic({ projectId });
                  } finally {
                    setRegeneratingMusic(false);
                  }
                }}
                disabled={regeneratingMusic}
                className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
              >
                {regeneratingMusic ? "..." : project.musicUrl ? "regenerate" : "start"}
              </button>
            )}
          </div>

          <div
            className={`flex items-center gap-3 p-4 rounded-lg ${
              project.videoUrls && project.videoUrls.length > 0
                ? "bg-green-50"
                : project.musicUrl && project.status === "processing"
                ? "bg-yellow-50 animate-pulse"
                : "bg-gray-50"
            }`}
          >
            <div
              className={`text-2xl ${
                project.videoUrls && project.videoUrls.length > 0 ? "opacity-100" : "opacity-30"
              }`}
            >
              {project.videoUrls && project.videoUrls.length > 0
                ? "✓"
                : project.musicUrl && project.status === "processing"
                ? "⏳"
                : "○"}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">5. animate images</p>
              <p className="text-sm text-gray-600">generating 3-second videos from images using fal ai</p>
            </div>
            {((project.videoUrls && project.videoUrls.length > 0) || (project.musicUrl && project.status === "failed")) &&
              project.status !== "processing" && (
                <button
                  onClick={async () => {
                    setRegeneratingAnimations(true);
                    try {
                      await regenerateAnimations({ projectId });
                    } finally {
                      setRegeneratingAnimations(false);
                    }
                  }}
                  disabled={regeneratingAnimations}
                  className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                >
                  {regeneratingAnimations
                    ? "..."
                    : project.videoUrls && project.videoUrls.length > 0
                    ? "regenerate"
                    : "start"}
                </button>
              )}
          </div>
        </div>
      </div>

      {project.script && (
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-2 gap-3">
            <p className="text-sm font-medium text-gray-700">generated script</p>
            <div className="flex items-center gap-2">
              {isEditingScript ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingScript(false);
                      setSaveScriptError(null);
                      // Replace ??? with ? for display
                      setScriptDraft((project.script ?? "").replace(/\?\?\?/g, "?"));
                    }}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveScript}
                    disabled={savingScript || !scriptDraft.trim()}
                    className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                  >
                    {savingScript ? "saving..." : "save"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingScript(true);
                    setSaveScriptError(null);
                    // Replace ??? with ? for editing
                    setScriptDraft((project.script ?? "").replace(/\?\?\?/g, "?"));
                  }}
                  className="px-3 py-1 text-xs bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  edit
                </button>
              )}
              <button
                onClick={async () => {
                  setRegeneratingScript(true);
                  try {
                    await regenerateScript({ projectId });
                  } finally {
                    setRegeneratingScript(false);
                  }
                }}
                className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50"
                disabled={regeneratingScript}
              >
                {regeneratingScript ? "..." : "regenerate"}
              </button>
            </div>
          </div>
          {isEditingScript ? (
            <div>
              <textarea
                value={scriptDraft}
                onChange={(event) => setScriptDraft(event.target.value)}
                disabled={savingScript}
                className="w-full min-h-[160px] rounded-lg border border-gray-200 p-4 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-60"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span>{scriptDraft.length} characters</span>
                {saveScriptError && <span className="text-red-600">{saveScriptError}</span>}
              </div>
            </div>
          ) : (
            <p className="text-gray-800 p-4 bg-gray-50 rounded-lg leading-relaxed whitespace-pre-wrap">
              {(project.script ?? "").replace(/\?\?\?/g, "?")}
            </p>
          )}
          {!isEditingScript && saveScriptError && (
            <p className="mt-2 text-xs text-red-600">{saveScriptError}</p>
          )}
        </div>
      )}

      {project.audioUrl && (
        <div className="border-t pt-6">
          <p className="text-sm font-medium text-gray-700 mb-2">voiceover</p>
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold text-purple-900">audio.mp3</p>
                <p className="text-xs text-purple-600">voiceover</p>
              </div>
              <audio controls className="w-full h-8 md:w-64">
                <source src={project.audioUrl} type="audio/mp3" />
              </audio>
            </div>
          </div>
        </div>
      )}

      {project.srtContent && (
        <div className="border-t pt-6">
          <p className="text-sm font-medium text-gray-700 mb-2">subtitles (SRT)</p>
          <div className="p-4 bg-gray-50 rounded-lg max-h-64 overflow-y-auto">
            <pre className="text-xs text-gray-800 font-mono whitespace-pre-wrap">{project.srtContent}</pre>
          </div>
        </div>
      )}

      {project.status === "rendering" && project.renderProgress && (
        <div className="border-t pt-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">render progress</h2>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-2xl animate-spin">⚙️</div>
              <div className="flex-1">
                <p className="font-semibold text-blue-900">{project.renderProgress.step}</p>
                {project.renderProgress.details && (
                  <p className="text-sm text-blue-700">{project.renderProgress.details}</p>
                )}
              </div>
            </div>
            <div className="mt-2 text-xs text-blue-600">
              last updated: {new Date(project.renderProgress.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      {project.renderedVideoUrl ? (
        <div className="border-t pt-6">
          <p className="text-sm font-medium text-gray-700 mb-3">convex storage</p>
          <p className="text-xs text-gray-500 mb-3">rendered video ready</p>
          <a
            href={project.renderedVideoUrl}
            download
            className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 text-purple-800 rounded-lg text-sm font-semibold hover:shadow-lg transition-all"
          >
            <span className="text-2xl">🎥</span>
            <div className="flex-1 text-left">
              <div className="font-bold">Main.mp4</div>
              <div className="text-xs text-purple-600">final rendered video from remotion</div>
            </div>
            <span className="text-xs">⬇</span>
          </a>
        </div>
      ) : (
        <div className="border-t pt-6">
          <p className="text-sm font-medium text-gray-700 mb-3">convex storage</p>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
            <div className="text-3xl mb-2">📁</div>
            <p className="text-sm text-gray-600">not rendered yet</p>
            <p className="text-xs text-gray-500 mt-1">click render button to generate video</p>
          </div>
        </div>
      )}

      {project.error && (
        <div className="border-t pt-6">
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm font-medium text-red-700 mb-1">error occurred</p>
            <p className="text-sm text-red-600">{project.error}</p>
          </div>
        </div>
      )}

      {project.status === "completed" && (
        <div className="border-t pt-6">
          <div className="p-6 bg-green-50 rounded-lg text-center border border-green-200">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-green-800 font-medium text-lg">project completed!</p>
            <p className="text-sm text-green-600 mt-1">all media files are ready to download</p>
          </div>
        </div>
      )}
    </div>
  );
}

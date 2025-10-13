"use client";

import { useCallback, useEffect, useState } from "react";
import { useAction } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

import type {
  CommandResult,
  PipelineStatus,
  ProjectDoc,
  SandboxFile,
  SandboxInfo,
} from "./types";

type SandboxTabContentProps = {
  project: ProjectDoc;
  projectId: Id<"projects">;
};

type SelectedFile = {
  name: string;
  content: string;
  isText: boolean;
};

export function SandboxTabContent({ project, projectId }: SandboxTabContentProps) {
  const getPipelineStatus = useAction(api.render.getPipelineStatus);
  const getSandboxInfo = useAction(api.render.getSandboxInfo);
  const createSequence = useAction(api.render.createSequence);
  const step1StartSandbox = useAction(api.render.step1StartSandbox);
  const step2UploadFiles = useAction(api.render.step2UploadFiles);
  const step3RunVideoEditor = useAction(api.render.step3RunVideoEditor);
  const step4RenderSequence = useAction(api.render.step4RenderSequence);
  const runSandboxCommand = useAction(api.render.runSandboxCommand);
  const listSandboxFiles = useAction(api.render.listSandboxFiles);
  const readSandboxFile = useAction(api.render.readSandboxFile);
  const getSandboxFileDownloadUrl = useAction(api.render.getSandboxFileDownloadUrl);
  const downloadSandboxFolder = useAction(api.render.downloadSandboxFolder);

  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [sandboxInfo, setSandboxInfo] = useState<SandboxInfo | null>(null);
  const [loadingSandbox, setLoadingSandbox] = useState(false);
  const [command, setCommand] = useState("");
  const [commandOutput, setCommandOutput] = useState<CommandResult | null>(null);
  const [runningCommand, setRunningCommand] = useState(false);
  const [outFiles, setOutFiles] = useState<SandboxFile[]>([]);
  const [mediaFiles, setMediaFiles] = useState<SandboxFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [loadingFileContent, setLoadingFileContent] = useState(false);
  const [creatingSequence, setCreatingSequence] = useState(false);
  const [step1Running, setStep1Running] = useState(false);
  const [step2Running, setStep2Running] = useState(false);
  const [step3Running, setStep3Running] = useState(false);
  const [step4Running, setStep4Running] = useState(false);

  const sandboxId = project.sandboxId;

  const refreshPipelineStatus = useCallback(async () => {
    try {
      const status = await getPipelineStatus({ projectId });
      setPipelineStatus(status);
    } catch (error) {
      console.error("[pipeline] failed to get status:", error);
    }
  }, [getPipelineStatus, projectId]);

  const loadFiles = useCallback(async () => {
    if (!sandboxId) return;

    setLoadingFiles(true);
    try {
      const [outResult, mediaResult] = await Promise.all([
        listSandboxFiles({ sandboxId, path: "/home/user/out" }),
        listSandboxFiles({ sandboxId, path: "/home/user/public/media" }),
      ]);

      if (outResult.success && "files" in outResult) {
        setOutFiles(outResult.files || []);
      }
      if (mediaResult.success && "files" in mediaResult) {
        setMediaFiles(mediaResult.files || []);
      }
    } finally {
      setLoadingFiles(false);
    }
  }, [listSandboxFiles, sandboxId]);

  useEffect(() => {
    refreshPipelineStatus();
    const interval = setInterval(refreshPipelineStatus, 5000);
    return () => clearInterval(interval);
  }, [refreshPipelineStatus]);

  useEffect(() => {
    if (!sandboxId) return;
    loadFiles();
  }, [loadFiles, sandboxId]);


  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div
          className={`p-6 rounded-xl border-2 ${
            pipelineStatus?.sandboxAlive
              ? "bg-green-50 border-green-300"
              : pipelineStatus?.sandboxExists
              ? "bg-yellow-50 border-yellow-300"
              : "bg-gray-50 border-gray-200"
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`text-3xl ${pipelineStatus?.sandboxAlive ? "animate-pulse" : ""}`}>
              {pipelineStatus?.sandboxAlive ? "🟢" : pipelineStatus?.sandboxExists ? "🟡" : "⚫"}
            </div>
            <div>
              <p className="font-bold text-gray-800">sandbox</p>
              <p className="text-xs text-gray-600">
                {pipelineStatus?.sandboxAlive ? "running" : pipelineStatus?.sandboxExists ? "paused/dead" : "not created"}
              </p>
            </div>
          </div>
          {pipelineStatus?.sandboxAlive ? (
            <button
              onClick={() => {
                if (!sandboxId) return;
                navigator.clipboard.writeText(sandboxId);
              }}
              className="mt-2 px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors text-xs w-full"
            >
              copy id
            </button>
          ) : (
            <button
              onClick={async () => {
                setCreatingSequence(true);
                try {
                  await createSequence({ projectId });
                  await refreshPipelineStatus();
                  await loadFiles();
                } finally {
                  setCreatingSequence(false);
                }
              }}
              disabled={creatingSequence}
              className="mt-2 px-3 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg transition-colors text-xs w-full disabled:opacity-50"
            >
              {creatingSequence ? "starting..." : pipelineStatus?.sandboxExists ? "restart sandbox" : "start sandbox"}
            </button>
          )}
        </div>

        <div
          className={`p-6 rounded-xl border-2 ${
            pipelineStatus?.videoRendered ? "bg-blue-50 border-blue-300" : "bg-gray-50 border-gray-200"
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="text-3xl">{pipelineStatus?.videoRendered ? "🎬" : "📭"}</div>
            <div>
              <p className="font-bold text-gray-800">output video</p>
              <p className="text-xs text-gray-600">{pipelineStatus?.videoRendered ? "ready" : "not rendered"}</p>
            </div>
          </div>
          {pipelineStatus?.videoRendered && sandboxId ? (
            <button
              onClick={async () => {
                const result = await getSandboxFileDownloadUrl({
                  sandboxId,
                  filePath: "/home/user/out/Main.mp4",
                });
                if (result.success && "downloadUrl" in result) {
                  setSelectedFile({
                    name: "Main.mp4",
                    content: result.downloadUrl || "",
                    isText: false,
                  });
                }
              }}
              className="mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-xs w-full"
            >
              preview video
            </button>
          ) : null}
        </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">render pipeline</h3>
        <div className="space-y-3">
          <div
            className={`p-4 rounded-lg border-2 ${
              step1Running
                ? "bg-blue-50 border-blue-300 animate-pulse"
                : pipelineStatus?.sandboxAlive
                ? "bg-green-50 border-green-300"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{pipelineStatus?.sandboxAlive ? "✅" : step1Running ? "⏳" : "1️⃣"}</span>
                <div>
                  <p className="font-medium text-gray-800">start sandbox</p>
                  <p className="text-xs text-gray-600">create/connect to e2b environment</p>
                </div>
              </div>
              {!pipelineStatus?.sandboxAlive && (
                <button
                  onClick={async () => {
                    setStep1Running(true);
                    try {
                      await step1StartSandbox({ projectId });
                      await refreshPipelineStatus();
                    } finally {
                      setStep1Running(false);
                    }
                  }}
                  disabled={step1Running}
                  className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-xs disabled:opacity-50"
                >
                  {step1Running ? "starting..." : pipelineStatus?.sandboxExists ? "restart" : "start"}
                </button>
              )}
            </div>
          </div>

          <div
            className={`p-4 rounded-lg border-2 ${
              step2Running
                ? "bg-blue-50 border-blue-300 animate-pulse"
                : pipelineStatus?.mediaUploaded
                ? "bg-green-50 border-green-300"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{pipelineStatus?.mediaUploaded ? "✅" : step2Running ? "⏳" : "2️⃣"}</span>
                <div>
                  <p className="font-medium text-gray-800">upload files</p>
                  <p className="text-xs text-gray-600">transfer media, audio, srt to sandbox</p>
                </div>
              </div>
              {pipelineStatus?.sandboxAlive && !pipelineStatus?.mediaUploaded && (
                <button
                  onClick={async () => {
                    setStep2Running(true);
                    try {
                      await step2UploadFiles({ projectId });
                      await refreshPipelineStatus();
                      await loadFiles();
                    } finally {
                      setStep2Running(false);
                    }
                  }}
                  disabled={step2Running}
                  className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-xs disabled:opacity-50"
                >
                  {step2Running ? "uploading..." : "upload"}
                </button>
              )}
            </div>
          </div>

          <div
            className={`p-4 rounded-lg border-2 ${
              step3Running
                ? "bg-blue-50 border-blue-300 animate-pulse"
                : pipelineStatus?.sequenceCreated
                ? "bg-green-50 border-green-300"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{pipelineStatus?.sequenceCreated ? "✅" : step3Running ? "⏳" : "3️⃣"}</span>
                <div>
                  <p className="font-medium text-gray-800">run video editor</p>
                  <p className="text-xs text-gray-600">claude analyzes footage and creates composition</p>
                </div>
              </div>
              {pipelineStatus?.mediaUploaded && !pipelineStatus?.sequenceCreated && (
                <button
                  onClick={async () => {
                    setStep3Running(true);
                    try {
                      await step3RunVideoEditor({ projectId });
                      await refreshPipelineStatus();
                      await loadFiles();
                    } finally {
                      setStep3Running(false);
                    }
                  }}
                  disabled={step3Running}
                  className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-xs disabled:opacity-50"
                >
                  {step3Running ? "editing..." : "run editor"}
                </button>
              )}
            </div>
          </div>

          <div
            className={`p-4 rounded-lg border-2 ${
              step4Running
                ? "bg-blue-50 border-blue-300 animate-pulse"
                : pipelineStatus?.videoRendered
                ? "bg-green-50 border-green-300"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{pipelineStatus?.videoRendered ? "✅" : step4Running ? "⏳" : "4️⃣"}</span>
                <div>
                  <p className="font-medium text-gray-800">render sequence</p>
                  <p className="text-xs text-gray-600">run bun remotion render</p>
                </div>
              </div>
              {pipelineStatus?.sequenceCreated && !pipelineStatus?.videoRendered && (
                <button
                  onClick={async () => {
                    setStep4Running(true);
                    try {
                      await step4RenderSequence({ projectId });
                      await refreshPipelineStatus();
                      await loadFiles();
                    } finally {
                      setStep4Running(false);
                    }
                  }}
                  disabled={step4Running}
                  className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-xs disabled:opacity-50"
                >
                  {step4Running ? "rendering..." : "render"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t pt-6">
        {sandboxId ? (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700">sandbox info</p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setLoadingSandbox(true);
                      try {
                        await refreshPipelineStatus();
                        const result = await getSandboxInfo({ sandboxId });
                        setSandboxInfo(result as SandboxInfo);
                      } finally {
                        setLoadingSandbox(false);
                      }
                    }}
                    disabled={loadingSandbox}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    {loadingSandbox ? "loading..." : "refresh"}
                  </button>
                  <button
                    onClick={async () => {
                      const result = await downloadSandboxFolder({
                        sandboxId,
                        folderPath: "/home/user",
                      });
                      if (result.success && "base64Content" in result) {
                        const binaryString = atob(result.base64Content || "");
                        const bytes = new Uint8Array(binaryString.length);
                        for (let index = 0; index < binaryString.length; index += 1) {
                          bytes[index] = binaryString.charCodeAt(index);
                        }
                        const blob = new Blob([bytes], { type: "application/zip" });
                        const url = URL.createObjectURL(blob);
                        const anchor = document.createElement("a");
                        anchor.href = url;
                        anchor.download = "sandbox.zip";
                        anchor.click();
                        URL.revokeObjectURL(url);
                      }
                    }}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    download
                  </button>
                </div>
              </div>
              {sandboxInfo ? (
                <div className="p-4 bg-gray-900 text-green-400 font-mono text-xs rounded-lg border border-gray-700 space-y-2">
                  {sandboxInfo.outDirectory && <p>out: {sandboxInfo.outDirectory}</p>}
                  {sandboxInfo.diskUsage && <p>disk: {sandboxInfo.diskUsage}</p>}
                  {sandboxInfo.error && <p className="text-red-400">error: {sandboxInfo.error}</p>}
                  {!sandboxInfo.outDirectory && !sandboxInfo.diskUsage && !sandboxInfo.error && (
                    <p className="text-gray-400">no sandbox details yet</p>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                  sandbox info not loaded
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">run command</p>
              <div className="p-4 bg-black rounded-lg border border-gray-700">
                <div className="flex items-center gap-3">
                  <input
                    value={command}
                    onChange={(event) => setCommand(event.target.value)}
                    placeholder="ls -la"
                    disabled={runningCommand}
                    className="flex-1 bg-transparent text-gray-100 font-mono text-sm outline-none placeholder-gray-500"
                  />
                  <button
                    onClick={async () => {
                      if (!command.trim()) return;
                      setRunningCommand(true);
                      setCommandOutput(null);
                      try {
                        const result = await runSandboxCommand({
                          sandboxId,
                          command,
                        });
                        if (result.success && "stdout" in result) {
                          setCommandOutput({
                            stdout: result.stdout || "",
                            stderr: result.stderr || "",
                            exitCode: result.exitCode || 0,
                          });
                        } else if ("error" in result) {
                          setCommandOutput({
                            stdout: "",
                            stderr: result.error || "command failed",
                            exitCode: 1,
                          });
                        }
                      } finally {
                        setRunningCommand(false);
                      }
                    }}
                    disabled={runningCommand}
                    className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-xs disabled:opacity-50"
                  >
                    run
                  </button>
                </div>
                {commandOutput && (
                  <div className="mt-2 font-mono text-xs">
                    {commandOutput.stdout && (
                      <pre className="text-gray-300 whitespace-pre-wrap">{commandOutput.stdout}</pre>
                    )}
                    {commandOutput.stderr && (
                      <pre className="text-red-400 whitespace-pre-wrap mt-2">{commandOutput.stderr}</pre>
                    )}
                    <div className="mt-2 text-[10px] text-gray-500">exit code: {commandOutput.exitCode}</div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 mb-3">media files (public/media/)</p>
                <button
                  onClick={async () => {
                    await refreshPipelineStatus();
                    await loadFiles();
                  }}
                  className="text-xs text-purple-600 hover:text-purple-800"
                  disabled={loadingFiles}
                >
                  refresh
                </button>
              </div>
              {loadingFiles ? (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 animate-pulse">
                  loading files...
                </div>
              ) : (
                <div className="space-y-2">
                  {mediaFiles.map((file) => (
                    <div key={file.path} className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="text-lg">{file.isDir ? "📁" : "📄"}</span>
                        <span className="text-sm font-mono">{file.name}</span>
                      </div>
                      {!file.isDir && (
                        <>
                          <button
                            onClick={async () => {
                              const result = await getSandboxFileDownloadUrl({
                                sandboxId,
                                filePath: file.path,
                              });
                              if (result.success && "downloadUrl" in result) {
                                window.open(result.downloadUrl, "_blank");
                              }
                            }}
                            className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-xs"
                            title="preview in browser"
                          >
                            👁
                          </button>
                          <button
                            onClick={async () => {
                              const result = await getSandboxFileDownloadUrl({
                                sandboxId,
                                filePath: file.path,
                              });
                              if (result.success && "downloadUrl" in result) {
                                const anchor = document.createElement("a");
                                anchor.href = result.downloadUrl || "";
                                anchor.download = file.name;
                                anchor.click();
                              }
                            }}
                            className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-xs"
                            title="download file"
                          >
                            ⬇
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  {mediaFiles.length === 0 && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                      no media files yet
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">output files (out/)</p>
              {outFiles.length > 0 ? (
                <div className="space-y-2">
                  {outFiles.map((file) => (
                    <div key={file.path} className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          if (file.isDir) return;
                          setLoadingFileContent(true);
                          setSelectedFile(null);
                          try {
                            const result = await readSandboxFile({
                              sandboxId,
                              filePath: file.path,
                            });
                            if (result.success && "content" in result) {
                              setSelectedFile({
                                name: file.name,
                                content: result.content || "",
                                isText: result.isText || false,
                              });
                            }
                          } finally {
                            setLoadingFileContent(false);
                          }
                        }}
                        disabled={file.isDir || loadingFileContent}
                        className="flex-1 text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{file.isDir ? "📁" : "📄"}</span>
                          <span className="text-sm font-mono">{file.name}</span>
                        </div>
                      </button>
                      {!file.isDir && (
                        <>
                          <button
                            onClick={async () => {
                              const result = await getSandboxFileDownloadUrl({
                                sandboxId,
                                filePath: file.path,
                              });
                              if (result.success && "downloadUrl" in result) {
                                window.open(result.downloadUrl, "_blank");
                              }
                            }}
                            className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-xs"
                            title="preview in browser"
                          >
                            👁
                          </button>
                          <button
                            onClick={async () => {
                              const result = await getSandboxFileDownloadUrl({
                                sandboxId,
                                filePath: file.path,
                              });
                              if (result.success && "downloadUrl" in result) {
                                const anchor = document.createElement("a");
                                anchor.href = result.downloadUrl || "";
                                anchor.download = file.name;
                                anchor.click();
                              }
                            }}
                            className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-xs"
                            title="download file"
                          >
                            ⬇
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                  no output files yet
                </div>
              )}
            </div>

            {selectedFile && (
              <div className="p-4 bg-black rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-green-400 font-mono text-sm">{selectedFile.name}</p>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-gray-400 hover:text-gray-200 text-xs"
                  >
                    close
                  </button>
                </div>
                {selectedFile.isText ? (
                  <pre className="text-gray-300 font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                    {atob(selectedFile.content)}
                  </pre>
                ) : selectedFile.name.endsWith(".mp4") || selectedFile.name.endsWith(".webm") ? (
                  <video
                    controls
                    className="w-full rounded"
                    src={
                      selectedFile.content.startsWith("http")
                        ? selectedFile.content
                        : `data:video/mp4;base64,${selectedFile.content}`
                    }
                  />
                ) : selectedFile.name.endsWith(".png") ||
                  selectedFile.name.endsWith(".jpg") ||
                  selectedFile.name.endsWith(".jpeg") ? (
                  <img
                    alt={selectedFile.name}
                    className="w-full rounded"
                    src={
                      selectedFile.content.startsWith("http")
                        ? selectedFile.content
                        : `data:image/png;base64,${selectedFile.content}`
                    }
                  />
                ) : (
                  <div className="text-gray-400 text-xs">binary file preview not available</div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
            sandbox not available yet
          </div>
        )}
      </div>
    </div>
  );
}

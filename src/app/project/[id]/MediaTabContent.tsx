"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { Video } from "lucide-react";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import DisplayCards from "@/components/ui/display-cards";
import MediaFileCard from "@/components/MediaFileCard";

import type { ProjectDoc } from "./types";

type MediaTabContentProps = {
  project: ProjectDoc;
  projectId: Id<"projects">;
};

export function MediaTabContent({ project, projectId }: MediaTabContentProps) {
  const generateUploadUrl = useMutation(api.tasks.generateUploadUrl);
  const addFilesToProject = useMutation(api.tasks.addFilesToProject);
  const animateImage = useAction(api.aiServices.animateImage);
  const addAnimatedVideo = useAction(api.tasks.addAnimatedVideo);

  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [animatingImageUrl, setAnimatingImageUrl] = useState<string | null>(null);

  const hasInputMedia =
    (project.fileUrls?.some((url) => Boolean(url)) ?? false) ||
    Boolean(project.musicUrl) ||
    ((project.videoUrls?.length || 0) > 0);

  const handleUpload = async (fileList: FileList | null, resetInput: () => void) => {
    const newFiles = Array.from(fileList || []);
    if (newFiles.length === 0) return;

    setUploadingFiles(true);
    try {
      const fileIds: Id<"_storage">[] = [];
      const fileMetadata: {
        storageId: Id<"_storage">;
        filename: string;
        contentType: string;
        size: number;
      }[] = [];

      for (const file of newFiles) {
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

      await addFilesToProject({
        projectId,
        files: fileIds,
        fileMetadata,
      });
    } catch (error) {
      console.error("upload error:", error);
      alert("failed to upload files");
    } finally {
      setUploadingFiles(false);
      resetInput();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-700">input media</p>
            <p className="text-xs text-gray-500">files that will be placed in public/media/</p>
          </div>
          <label className={`px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-xs cursor-pointer ${uploadingFiles ? "opacity-50" : ""}`}>
            {uploadingFiles ? "uploading..." : "upload more"}
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              disabled={uploadingFiles}
              onChange={async (event) => {
                const input = event.target;
                await handleUpload(input.files, () => {
                  input.value = "";
                });
              }}
            />
          </label>
        </div>
        {hasInputMedia ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {project.fileUrls?.map((url, index) =>
              url ? (
                <MediaFileCard
                  key={`file-${index}`}
                  url={url}
                  index={index}
                  isAnimating={animatingImageUrl === url}
                  onAnimate={async (imageUrl) => {
                    setAnimatingImageUrl(imageUrl);
                    try {
                      const result = await animateImage({ imageUrl });
                      if (result.success && result.data?.video?.url) {
                        await addAnimatedVideo({
                          projectId,
                          videoUrl: result.data.video.url,
                        });
                      } else {
                        alert("animation failed");
                      }
                    } catch (error) {
                      console.error("animate error:", error);
                      alert("animation failed");
                    } finally {
                      setAnimatingImageUrl(null);
                    }
                  }}
                />
              ) : null
            )}
            {project.musicUrl && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-2xl mb-2">🎵</div>
                <p className="text-xs font-medium text-blue-900">music.mp3</p>
                <p className="text-xs text-blue-600 mb-2">background</p>
                <audio controls className="w-full h-8">
                  <source src={project.musicUrl} type="audio/mp3" />
                </audio>
              </div>
            )}
            {project.videoUrls?.map((url, index) => (
              <div key={index} className="p-3 bg-pink-50 border border-pink-200 rounded-lg">
                <div className="text-2xl mb-2">🎬</div>
                <p className="text-xs font-medium text-pink-900">video{index}.mp4</p>
                <p className="text-xs text-pink-600">animated</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
            no input media yet
          </div>
        )}
      </div>

      {(project.videoUrls?.length || 0) > 0 && (
        <div className="border-t pt-6">
          <p className="text-sm font-medium text-gray-700 mb-1">generated media</p>
          <p className="text-xs text-gray-500 mb-3">ai-animated videos from images</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {project.videoUrls?.map((url, index) => (
              <div key={index} className="relative group">
                <div className="p-3 bg-pink-50 border border-pink-200 rounded-lg">
                  <div
                    className="w-full h-20 bg-pink-100 rounded mb-2 overflow-hidden"
                    onMouseEnter={(event) => {
                      const video = event.currentTarget.querySelector("video");
                      if (video) video.play();
                    }}
                    onMouseLeave={(event) => {
                      const video = event.currentTarget.querySelector("video");
                      if (video) {
                        video.pause();
                        video.currentTime = 0;
                      }
                    }}
                  >
                    <video src={url} className="w-full h-full object-cover" muted loop />
                  </div>
                  <p className="text-xs font-medium text-pink-900">video {index + 1}</p>
                  <p className="text-xs text-pink-600">🎬 animated</p>
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 bg-pink-600/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm font-medium"
                >
                  view full
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {(project.videoUrls?.length || 0) > 0 && (
        <div className="border-t pt-6">
          <p className="text-sm font-medium text-gray-700 mb-1">generated media</p>
          <p className="text-xs text-gray-500 mb-6">all ai-generated files ready to download</p>
          <DisplayCards
            cards={[
              ...(project.videoUrls?.slice(0, 3).map((url, index) => ({
                icon: <Video className="size-4 text-pink-300" />,
                title: `video ${index + 1}`,
                description: "3-second animation",
                date: "ai-generated",
                titleClassName: "text-pink-500",
                mediaUrl: url,
                mediaType: "video" as const,
                className:
                  index === 0
                    ? "[grid-area:stack] hover:-translate-y-10 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0"
                    : index === 1
                    ? "[grid-area:stack] translate-x-16 translate-y-10 hover:-translate-y-1 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0"
                    : "[grid-area:stack] translate-x-32 translate-y-20 hover:translate-y-10",
              })) || []),
            ]}
          />
        </div>
      )}
    </div>
  );
}

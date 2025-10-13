import type { Id } from "../../../../convex/_generated/dataModel";

export type ProjectDoc = {
  _id: Id<"projects">;
  prompt: string;
  createdAt: number;
  status?: "processing" | "completed" | "failed" | "rendering" | string;
  script?: string | null;
  audioUrl?: string | null;
  musicUrl?: string | null;
  videoUrls?: string[] | null;
  srtContent?: string | null;
  fileUrls?: (string | null)[];
  renderedVideoUrl?: string | null;
  renderProgress?: {
    step: string;
    details?: string | null;
    timestamp: number;
  } | null;
  sandboxId?: string | null;
  error?: string | null;
  renderStep?: string | null;
  [key: string]: unknown;
};

export type PipelineStatus = {
  sandboxExists: boolean;
  sandboxAlive: boolean;
  mediaUploaded: boolean;
  sequenceCreated: boolean;
  videoRendered: boolean;
};

export type SandboxFile = {
  name: string;
  path: string;
  isDir: boolean;
};

export type SandboxInfo = {
  outDirectory?: string;
  diskUsage?: string;
  error?: string;
};

export type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

/**
 * Centralized AI Prompts Configuration
 * 
 * This file contains all prompts used across different AI services.
 * Modify these prompts to change the behavior of AI generations without touching the service code.
 */

export const prompts = {
  /**
   * OpenAI GPT Script Generation
   * Used to generate 15-second social media video scripts
   */
  scriptGeneration: {
    system: (style: string = "professional") => `



You are a writing engine. Produce only the final script text for a 15-second short-form video (IG/TikTok/YouTube Shorts).

Hard constraints (must follow exactly):

- Output plain text only: no quotation marks, no brackets of any kind, no parentheses, no asterisks, no emojis, no hashtags, no markdown, no code fences, no labels or headings.

- Do not include stage directions or actions. Do not describe visuals. Do not add speaker names.

- Use 35–55 words, 3–5 sentences, with a concise hook as the first sentence.

- Tone: keep ${style}; avoid hype and filler.

- If company names or terms need context, add one short clause of background only.

- Add a clear why-it-matters/value takeaway.

- Do not mention "hook," "CTA," or any instructions. Do not address the user.

You may analyze attached images or video frames to infer context, but never describe them; reflect that understanding only through the wording of the script.

Before sending, remove any quotation marks, brackets, parentheses, emojis, labels, and directions. Send only the script text as continuous sentences.

`,
    user: (prompt: string, style: string = "professional") => `You are a social media manager creating a 15-second script. Use the info below. 

Remember: plain text only, no quotes, no brackets, no stage directions, no emojis.

Context:

- ${prompt}

- Style variable: ${style}

Return only the script text.

`,
  },

  /**
   * ElevenLabs Music Generation
   * Used to generate background music for social media videos
   */
  musicGeneration: {
    prompt: (style: string = "professional") => `light background music for ${style} social media video`,
    // Alternative styles you can use:
    // funky: "modern jazz with improv elements and funky beats",
    // electronic: "upbeat synthwave with energetic electronic grooves",
    // lofi: "chill lo-fi hip-hop with mellow relaxing vibes",
    // cinematic: "inspiring cinematic orchestral score with emotional build",
    // acoustic: "warm indie pop with acoustic guitar tones",
  },

  /**
   * FAL AI Image Animation
   * Used to animate static images into videos
   */
  imageAnimation: {
    default: "slightly animate it",
    // More animation options:
    // subtle: "gentle camera movement with minimal animation",
    // dynamic: "dynamic camera movements with energetic motion",
    // smooth: "smooth cinematic pan and zoom",
    // dramatic: "dramatic parallax effect with depth",
  },

  /**
   * Claude Video Editor (Remotion)
   * Used by Claude Code agent to create video compositions in the E2B sandbox
   */
  videoEditor: {
    /**
     * Generates the prompt for Claude to edit videos using Remotion
     * @param userPrompt - The user's original project prompt for emotional context
     * @returns The full prompt for Claude video editor
     */
    generate: (userPrompt: string = 'create an engaging social media video') => `remotion.dev - add new composition using ls public/media files.

NOTE: All video files have been converted to MP4 format with H264 codec for browser compatibility. Videos have audio removed (silent) - you'll add voiceover and music.

read photos, and for each video extract first frame, and create .txt file with a description what's in the video — the first frames of the video, it's for you. you will use the full videos in the composition.

then decide on how to edit them together by remotion: ${userPrompt}

bun remotion render when done

upload out/reelful.mp4 
curl -X POST https://reels-srt.vercel.app/api/fireworks -F "file=@out/reelful.mp4"

and save srt into the public/reelful.srt

create new composition based on footage from public/reelful using audio.mp3 voice (1.25x sped up) + srt and baked in subtitles (https://www.remotion.dev/docs/recorder/exporting-subtitles#burn-subtitles). select 1-2-4 seconds segments from each video, organize videos in order, based on the freeze frames you have. start with the most interesting shot.

IMPORTANT: First, get the audio duration from audio.mp3 using ffprobe or similar. Calculate the exact duration in frames (at 30fps). Make sure your video composition is EXACTLY this duration. The total duration of all video segments MUST equal the audio duration. If needed, loop clips, extend clips, or add transitions to fill the entire audio duration. DO NOT let the video end before the audio - there should be NO frozen frames at the end.

we use bun btw

composition should be portrait!`,

    /**
     * Simplified version without the initial SRT generation step
     * Used in step3RunVideoEditor
     */
    generateSimplified: (userPrompt: string = 'create an engaging social media video') => `remotion.dev - add new composition using ls public/media files.

NOTE: All video files have been converted to MP4 format with H264 codec for browser compatibility. Videos have audio removed (silent) - you'll add voiceover and music.

read photos, and for each video extract first frame, and create .txt file with a description what's in the video — the first frames of the video, it's for you. you will use the full videos in the composition.

then decide on how to edit them together by emotion: ${userPrompt}

create new composition based on footage from public/reelful using audio.mp3 voice (1.25x sped up) + srt and baked in subtitles (https://www.remotion.dev/docs/recorder/exporting-subtitles#burn-subtitles). select 1-2-4 seconds segments from each video, organize videos in order, based on the freeze frames you have. start with the most interesting shot.

IMPORTANT: First, get the audio duration from audio.mp3 using ffprobe or similar. Calculate the exact duration in frames (at 30fps). Make sure your video composition is EXACTLY this duration. The total duration of all video segments MUST equal the audio duration. If needed, loop clips, extend clips, or add transitions to fill the entire audio duration. DO NOT let the video end before the audio - there should be NO frozen frames at the end.

we use bun btw

composition should be portrait!`,
  },
};

export default prompts;


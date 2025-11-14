"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

type PreferredStyle = "playful" | "professional" | "travel";

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<PreferredStyle | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const { userId, signOut, isInitialized } = useAuth();
  const currentUser = useQuery(api.users.getCurrentUser, userId ? { userId } : "skip");
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (isInitialized && !userId) {
      router.push("/auth");
    }
  }, [isInitialized, userId, router]);

  // Redirect if already completed onboarding
  useEffect(() => {
    if (currentUser && currentUser.onboardingCompleted) {
      router.push("/");
    }
  }, [currentUser, router]);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleComplete = async () => {
    if (!name || !selectedStyle || !userId) {
      alert("Please complete all steps");
      return;
    }

    setLoading(true);
    try {
      let voiceStorageId;
      
      // Upload voice recording if available
      if (audioBlob) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": audioBlob.type },
          body: audioBlob,
        });
        const { storageId } = await result.json();
        voiceStorageId = storageId;
      }

      await completeOnboarding({
        userId,
        name,
        preferredStyle: selectedStyle,
        voiceRecordingStorageId: voiceStorageId,
      });

      router.push("/");
    } catch (error) {
      console.error("Error completing onboarding:", error);
      alert("Failed to complete onboarding. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const styles: { value: PreferredStyle; label: string; description: string; emoji: string }[] = [
    { value: "playful", label: "playful", description: "fun, energetic, and creative", emoji: "🎨" },
    { value: "professional", label: "professional", description: "polished, business-focused", emoji: "💼" },
    { value: "travel", label: "travel", description: "adventurous and wanderlust", emoji: "✈️" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-blue-900">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">welcome aboard!</h1>
          <p className="text-purple-200">let's personalize your experience</p>
          <div className="mt-4 flex justify-center gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-2 w-16 rounded-full transition-all ${
                  i === step ? "bg-white" : i < step ? "bg-purple-400" : "bg-purple-700"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Step 1: Name */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">what's your name?</h2>
                <p className="text-gray-600">we'll use this to personalize your experience</p>
              </div>
              
              <div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="enter your name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent text-gray-900 text-lg"
                  autoFocus
                />
              </div>

              <button
                onClick={() => name && setStep(2)}
                disabled={!name}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                continue
              </button>
            </div>
          )}

          {/* Step 2: Style */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">choose your style</h2>
                <p className="text-gray-600">this helps us create content that matches your vibe</p>
              </div>

              <div className="space-y-3">
                {styles.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => setSelectedStyle(style.value)}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      selectedStyle === style.value
                        ? "border-purple-600 bg-purple-50"
                        : "border-gray-200 bg-white hover:border-purple-300"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{style.emoji}</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 capitalize">{style.label}</h3>
                        <p className="text-sm text-gray-600">{style.description}</p>
                      </div>
                      {selectedStyle === style.value && (
                        <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M5 13l4 4L19 7"></path>
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 px-4 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-all"
                >
                  back
                </button>
                <button
                  onClick={() => selectedStyle && setStep(3)}
                  disabled={!selectedStyle}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Voice Recording */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">record your voice</h2>
                <p className="text-gray-600">this helps us clone your voice for narrations (optional)</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-6 text-center">
                {!audioBlob ? (
                  <>
                    <div className="w-20 h-20 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                      <svg className="w-10 h-10 text-purple-600" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                      </svg>
                    </div>
                    <p className="text-gray-700 mb-4">
                      {recording ? "recording... click stop when done" : "click to start recording"}
                    </p>
                    {recording && (
                      <div className="mb-4 flex justify-center">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className="w-2 h-8 bg-purple-600 rounded-full animate-pulse"
                              style={{ animationDelay: `${i * 0.15}s` }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      onClick={recording ? stopRecording : startRecording}
                      className={`px-6 py-3 rounded-lg font-medium transition-all ${
                        recording
                          ? "bg-red-600 hover:bg-red-700 text-white"
                          : "bg-purple-600 hover:bg-purple-700 text-white"
                      }`}
                    >
                      {recording ? "stop recording" : "start recording"}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-10 h-10 text-green-600" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                    <p className="text-gray-700 mb-4">recording saved!</p>
                    <audio src={URL.createObjectURL(audioBlob)} controls className="w-full mb-4" />
                    <button
                      onClick={() => setAudioBlob(null)}
                      className="px-6 py-2 text-purple-600 hover:text-purple-700 font-medium"
                    >
                      record again
                    </button>
                  </>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 px-4 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-all"
                >
                  back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "completing..." : audioBlob ? "complete onboarding" : "skip & complete"}
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => signOut()}
          className="mt-4 w-full py-2 text-purple-200 hover:text-white transition-colors"
        >
          sign out
        </button>
      </div>
    </div>
  );
}


"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

// Common country codes
const countryCodes = [
  { code: "+1", country: "US/CA", flag: "🇺🇸" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+86", country: "China", flag: "🇨🇳" },
  { code: "+81", country: "Japan", flag: "🇯🇵" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+61", country: "Australia", flag: "🇦🇺" },
  { code: "+7", country: "Russia", flag: "🇷🇺" },
  { code: "+55", country: "Brazil", flag: "🇧🇷" },
  { code: "+52", country: "Mexico", flag: "🇲🇽" },
  { code: "+34", country: "Spain", flag: "🇪🇸" },
  { code: "+39", country: "Italy", flag: "🇮🇹" },
  { code: "+82", country: "S. Korea", flag: "🇰🇷" },
  { code: "+27", country: "S. Africa", flag: "🇿🇦" },
];

export default function AuthPage() {
  const [countryCode, setCountryCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useTwilioVerify, setUseTwilioVerify] = useState(false);
  
  const sendOTP = useAction(api.phoneAuth.sendOTP);
  const verifyOTP = useMutation(api.users.verifyOTP);
  const verifyTwilioOTP = useAction(api.twilioVerify.verifyTwilioOTP);
  const router = useRouter();
  const { setUserId } = useAuth();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const fullPhone = countryCode + phoneNumber;
      const result = await sendOTP({ phone: fullPhone });
      
      // Check if Twilio Verify was used
      setUseTwilioVerify(result.useTwilioVerify || false);
      
      setStep("code");
      
      // Show appropriate message
      if (!result.useTwilioVerify) {
        alert(`Development Mode: Check the browser console for the OTP code. In production, this will be sent via SMS.`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const fullPhone = countryCode + phoneNumber;
      
      let result;
      if (useTwilioVerify) {
        // Use Twilio Verify verification
        result = await verifyTwilioOTP({ phone: fullPhone, code });
      } else {
        // Use local OTP verification
        result = await verifyOTP({ phone: fullPhone, code });
      }
      
      if (result.success && result.userId) {
        setUserId(result.userId);
        if (result.onboardingCompleted) {
          router.push("/");
        } else {
          router.push("/onboarding");
        }
      }
    } catch (err: any) {
      setError(err.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-purple-800 to-blue-900">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">welcome to sorah</h1>
          <p className="text-gray-600">sign in with your phone number</p>
        </div>

        {step === "phone" ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                phone number
              </label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent text-gray-900 bg-white cursor-pointer"
                  style={{ minWidth: "120px" }}
                >
                  {countryCodes.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => {
                    // Only allow numbers
                    const value = e.target.value.replace(/\D/g, "");
                    setPhoneNumber(value);
                  }}
                  placeholder="1234567890"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent text-gray-900"
                  required
                  maxLength={15}
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                enter your phone number without the country code
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "sending code..." : "send verification code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                verification code
              </label>
              <input
                type="text"
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent text-gray-900 text-center text-2xl tracking-widest"
                required
                maxLength={6}
              />
              <p className="mt-1 text-sm text-gray-500">
                enter the 6-digit code sent to {countryCode} {phoneNumber}
              </p>
              <p className="mt-1 text-xs text-blue-600">Development: Check the browser console for the OTP code</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "verifying..." : "verify code"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
              className="w-full py-2 px-4 text-gray-600 hover:text-gray-900 transition-colors text-sm"
            >
              ← use different number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}


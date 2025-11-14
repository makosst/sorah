import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password({
      id: "phone-otp",
      // We'll use the password field for OTP codes temporarily
      // In production, integrate with an SMS provider like Twilio
    }),
  ],
});


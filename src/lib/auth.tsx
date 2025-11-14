"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Id } from "../../convex/_generated/dataModel";

interface AuthContextType {
  userId: Id<"users"> | null;
  setUserId: (id: Id<"users"> | null) => void;
  signOut: () => void;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserIdState] = useState<Id<"users"> | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Only run on client-side to avoid hydration issues
    if (typeof window !== "undefined") {
      const storedUserId = localStorage.getItem("sorah_user_id");
      if (storedUserId) {
        setUserIdState(storedUserId as Id<"users">);
      }
      setIsInitialized(true);
    }
  }, []);

  const setUserId = (id: Id<"users"> | null) => {
    setUserIdState(id);
    if (typeof window !== "undefined") {
      if (id) {
        localStorage.setItem("sorah_user_id", id);
      } else {
        localStorage.removeItem("sorah_user_id");
      }
    }
  };

  const signOut = () => {
    setUserIdState(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("sorah_user_id");
    }
  };

  // Don't block rendering, just provide initialization state
  return (
    <AuthContext.Provider value={{ userId, setUserId, signOut, isInitialized }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}


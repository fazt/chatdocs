"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const { login, register, error, loading } = useAuthStore();
  const router = useRouter();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      let success: boolean;
      if (mode === "login") {
        success = await login(email, password);
      } else {
        success = await register(email, password, name || undefined);
      }
      if (success) router.push("/");
    },
    [mode, email, password, name, login, register, router]
  );

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Bot className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-xl font-bold">ChatDocs</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login"
              ? "Sign in to your account"
              : "Create a new account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <Input
              type="text"
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <button
              onClick={() => { setMode("register"); useAuthStore.setState({ error: null }); }}
              className="hover:text-foreground transition-colors"
            >
              Don&apos;t have an account? Sign up
            </button>
          ) : (
            <button
              onClick={() => { setMode("login"); useAuthStore.setState({ error: null }); }}
              className="hover:text-foreground transition-colors"
            >
              Already have an account? Sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

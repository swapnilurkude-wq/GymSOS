import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/context/theme-context"
import { AuthProvider } from "@/context/auth-context"
import { TooltipProvider } from "@/components/ui/tooltip"
import { isDemoMode, isSupabaseConfigured } from "@/lib/supabase"

const rootElement = document.getElementById("root")!

// A production build must never silently run on browser
// storage: without Supabase there is no database, so show a
// configuration error instead of the app. Demo mode remains
// available in development (npm run dev / npm test).
if (!isSupabaseConfigured() && !isDemoMode()) {
  createRoot(rootElement).render(
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="font-display text-xl font-semibold text-foreground">
        GymSOS isn&apos;t configured
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This build is missing its environment variables. Set{" "}
        <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">
          VITE_SUPABASE_URL
        </code>{" "}
        and{" "}
        <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">
          VITE_SUPABASE_ANON_KEY
        </code>{" "}
        (see &quot;Deploying for production&quot; in README.md) and redeploy.
      </p>
    </main>
  )
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>
  )
}

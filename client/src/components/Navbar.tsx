import { Moon, Sun, AlertTriangle } from "lucide-react"
import { useState, useEffect } from "react"
import { useTheme } from "./theme-provider"
import codeRunnerLogo from "../assets/CodeRunner.webp"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import KeyboardShortcutsModal from "./KeyboardShortcutsModal";

export function Navbar() {
  const { theme, setTheme } = useTheme()
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "?") {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        )
          return;
        setShowShortcuts(true);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-col">
      {/* Navbar - Redesigned */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center px-6 gap-6">
          {/* Brand Section */}
          <div className="flex items-center gap-3">
            <img
              src={codeRunnerLogo}
              alt="CodeRunner Logo"
              className="h-8 w-auto"
            />
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-none">CodeRunner</span>
              <span className="text-xs text-muted-foreground">Web IDE</span>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Warning Icon with Tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all h-10 w-10 cursor-help">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-sm">Your work is temporary and will be lost when you close this tab.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground h-10 w-10 hover:scale-105 active:scale-95"
            aria-label="Toggle theme"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </button>
          {/* Help / Shortcuts Button */}
          <button
            aria-label="Keyboard shortcuts"
            onClick={() => setShowShortcuts(true)}
            className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground h-10 w-10 hover:scale-105 active:scale-95"
          >
            ?
          </button>
        </div>
      </nav>
      <KeyboardShortcutsModal
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
      />
    </div>
  )
}

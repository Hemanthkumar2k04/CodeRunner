import { Moon, Sun, AlertTriangle, Menu, X } from "lucide-react"
import { useState, useEffect } from "react"
import { useTheme } from "./theme-provider"
import fabricLogo from "../assets/fabric.png"
import codeRunnerLogo from "../assets/CodeRunner.png"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import KeyboardShortcutsModal from "./KeyboardShortcutsModal"

interface ResponsiveNavbarProps {
  onMenuClick: () => void;
  isMenuOpen: boolean;
}

export function ResponsiveNavbar({ onMenuClick, isMenuOpen }: ResponsiveNavbarProps) {
  const { theme, setTheme } = useTheme()
  const [showShortcuts, setShowShortcuts] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "?") {
        const target = e.target as HTMLElement | null
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        )
          return
        setShowShortcuts(true)
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div className="flex flex-col">
      {/* Navbar - Responsive */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 sm:h-16 items-center px-3 sm:px-6 gap-2 sm:gap-6">
          {/* Mobile Menu Button - Always visible on mobile/tablet */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="h-9 w-9 lg:hidden shrink-0"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          {/* Logo Section - Hidden on mobile, shown on tablet+ */}
          <a
            href="https://fabric-eec.vercel.app"
            target="_blank"
            rel="noreferrer"
            className="hidden md:flex items-center gap-3 px-2 sm:px-4 py-2 rounded-lg hover:bg-accent/50 transition-all duration-200 group"
          >
            <img
              src={fabricLogo}
              alt="Fabric Logo"
              className="h-7 sm:h-9 w-auto group-hover:scale-105 transition-transform"
            />
            <div className="hidden lg:block h-8 w-px bg-border" />
          </a>

          {/* Brand Section */}
          <div className="flex items-center gap-2 sm:gap-3">
            <img
              src={codeRunnerLogo}
              alt="CodeRunner Logo"
              className="h-6 sm:h-8 w-auto"
            />
            <div className="flex flex-col">
              <span className="font-bold text-base sm:text-lg leading-none">CodeRunner</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Web IDE</span>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Warning Icon with Tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all h-9 w-9 sm:h-10 sm:w-10 cursor-help">
                    <AlertTriangle className="h-4 sm:h-5 w-4 sm:w-5 text-yellow-400" />
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
              className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground h-9 w-9 sm:h-10 sm:w-10 hover:scale-105 active:scale-95"
              aria-label="Toggle theme"
            >
              <Sun className="h-4 sm:h-5 w-4 sm:w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 sm:h-5 w-4 sm:w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </button>

            {/* Help / Shortcuts Button */}
            <button
              aria-label="Keyboard shortcuts"
              onClick={() => setShowShortcuts(true)}
              className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground h-9 w-9 sm:h-10 sm:w-10 hover:scale-105 active:scale-95"
            >
              ?
            </button>
          </div>
        </div>
      </nav>

      <KeyboardShortcutsModal
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
      />
    </div>
  )
}
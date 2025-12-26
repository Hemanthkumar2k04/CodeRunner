import { Code2, Moon, Sun } from "lucide-react"
import { useTheme } from "./theme-provider"
import fabricLogo from "../assets/fabric.png"

export function Navbar() {
  const { theme, setTheme } = useTheme()

  return (
    <nav className="border-b bg-background">
      <div className="flex h-16 items-center px-4 container mx-auto">
        <a href="https://fabric-eec.vercel.app" target="_blank" rel="noreferrer" className="mr-4 hover:opacity-80 transition-opacity">
          <img src={fabricLogo} alt="Club Logo" className="h-8 w-auto" />
        </a>
        <div className="flex items-center gap-2 font-bold text-xl mr-auto">
          <Code2 className="h-6 w-6" />
          <span>CodeRunner</span>
        </div>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-10 w-10"
          aria-label="Toggle theme"
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </button>
      </div>
    </nav>
  )
}

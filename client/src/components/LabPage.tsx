import { Link } from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';
import { useTheme } from './theme-provider';
import { Moon, Sun } from 'lucide-react';

export function LabPage() {
    const { theme, setTheme } = useTheme();

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
            {/* Dynamic Background Matches Home */}
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px]" />
            <div className="absolute h-full w-full bg-background [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

            {/* Header */}
            <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b/50 bg-background/50 backdrop-blur-sm">
                <Link
                    to="/"
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
                >
                    <span className="p-1 rounded-md bg-muted/50 group-hover:bg-muted group-hover:-translate-x-0.5 transition-all">
                        <ArrowLeft className="h-4 w-4" />
                    </span>
                    Back to Home
                </Link>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                        className="inline-flex items-center justify-center rounded-lg h-9 w-9 hover:bg-accent hover:text-accent-foreground transition-all hover:scale-105 active:scale-95"
                        aria-label="Toggle theme"
                    >
                        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 animate-in fade-in duration-700 ease-out">
                <div className="text-center max-w-md mx-auto space-y-6">
                    <div className="inline-flex items-center justify-center p-6 rounded-3xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20 mb-4 animate-pulse">
                        <Construction className="h-16 w-16" />
                    </div>

                    <h1 className="text-4xl font-extrabold tracking-tight">Under Construction</h1>

                    <p className="text-lg text-muted-foreground">
                        The Virtual Lab featuring curated educational environments and structured assignments is currently in development.
                    </p>

                    <div className="pt-8">
                        <Link
                            to="/editor"
                            className="inline-flex items-center justify-center rounded-full h-11 px-8 py-2 font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            Try the Code Editor Meanwhile
                        </Link>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 py-6 text-center text-sm text-muted-foreground/60">
                Developed by Hemanthkumar K, CSE Department, Easwari Engineering College
            </footer>
        </div>
    );
}

import { Link } from 'react-router-dom';
import { Code2, FlaskConical, Github } from 'lucide-react';
import { useTheme } from './theme-provider';
import codeRunnerLogo from '../assets/CodeRunner.webp';
import { Moon, Sun } from 'lucide-react';

export function HomePage() {
    const { theme, setTheme } = useTheme();

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
            {/* Dynamic Background */}
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px]" />
            <div className="absolute h-full w-full bg-background [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

            {/* Header */}
            <header className="relative z-10 flex items-center justify-end px-6 py-4 border-b/50 bg-background/50 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <a
                        href="https://github.com/OWNER/CodeRunner"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-lg h-9 w-9 hover:bg-accent hover:text-accent-foreground transition-all hover:scale-105 active:scale-95"
                        aria-label="GitHub Repository"
                    >
                        <Github className="h-5 w-5" />
                    </a>
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
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 animate-in slide-in-from-bottom-8 duration-700 fade-in zoom-in-95 ease-out">
                {/* Hero Section */}
                <div className="text-center mb-16 space-y-4">
                    <div className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-primary/10 ring-1 ring-primary/20 shadow-2xl shadow-primary/20">
                        <img
                            src={codeRunnerLogo}
                            alt="CodeRunner Logo"
                            className="h-16 w-16 drop-shadow-md"
                        />
                    </div>
                    <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                        CodeRunner
                    </h1>
                    <p className="text-lg sm:text-xl text-muted-foreground font-medium max-w-lg mx-auto">
                        A high-performance web-based code execution platform for educational lab environments.
                    </p>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-4xl px-4">

                    {/* Editor Card */}
                    <Link
                        to="/editor"
                        className="group relative flex flex-col p-[2px] rounded-3xl shadow-sm hover:shadow-xl transition-[transform,box-shadow] duration-300 hover:-translate-y-1 overflow-hidden"
                    >
                        {/* Shifting Colors Border Alternative */}
                        <div className="absolute inset-[-100%] animate-[spin_3s_linear_infinite] opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[conic-gradient(from_90deg,#3b82f6,#8b5cf6,#ec4899,#3b82f6)] pointer-events-none" />

                        {/* Card Content */}
                        <div className="relative h-full flex flex-col p-8 rounded-[calc(1.5rem-2px)] bg-zinc-100 dark:bg-zinc-900 border border-border group-hover:border-transparent transition-[border-color] duration-300">
                            <div className="relative flex items-center gap-4 mb-4">
                                <div className="p-3 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 ring-1 ring-zinc-300 dark:ring-zinc-700">
                                    <Code2 className="h-6 w-6" />
                                </div>
                                <h2 className="text-2xl font-bold tracking-tight">Code Editor</h2>
                            </div>

                            <p className="text-muted-foreground leading-relaxed relative z-10">
                                Launch the full-featured browser IDE. Write, run, and debug Python, JavaScript, Java, C++, and SQL with real-time output streaming.
                            </p>

                            <div className="mt-8 flex items-center font-medium text-foreground group-hover:translate-x-1 transition-transform duration-300 relative z-10">
                                Open Editor →
                            </div>
                        </div>
                    </Link>

                    {/* Lab Card */}
                    <Link
                        to="/lab"
                        className="group relative flex flex-col p-[2px] rounded-3xl shadow-sm hover:shadow-xl transition-[transform,box-shadow] duration-300 hover:-translate-y-1 overflow-hidden"
                    >
                        {/* Shifting Colors Border Alternative */}
                        <div className="absolute inset-[-100%] animate-[spin_3s_linear_infinite] opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[conic-gradient(from_270deg,#ec4899,#8b5cf6,#3b82f6,#ec4899)] pointer-events-none" />

                        {/* Card Content */}
                        <div className="relative h-full flex flex-col p-8 rounded-[calc(1.5rem-2px)] bg-zinc-100 dark:bg-zinc-900 border border-border group-hover:border-transparent transition-[border-color] duration-300">
                            <div className="relative flex items-center gap-4 mb-4">
                                <div className="p-3 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 ring-1 ring-zinc-300 dark:ring-zinc-700">
                                    <FlaskConical className="h-6 w-6" />
                                </div>
                                <h2 className="text-2xl font-bold tracking-tight">Virtual Lab</h2>
                            </div>

                            <p className="text-muted-foreground leading-relaxed relative z-10">
                                Access curated educational lab environments, structured programming assignments, and automated evaluation tools.
                            </p>

                            <div className="mt-8 flex items-center font-medium text-foreground group-hover:translate-x-1 transition-transform duration-300 relative z-10">
                                Enter Lab →
                            </div>
                        </div>
                    </Link>

                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 py-6 text-center text-sm text-muted-foreground/60">
                Developed by Hemanthkumar K, CSE Department of Easwari Engineering College
            </footer>
        </div>
    );
}

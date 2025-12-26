import './App.css'
import { ThemeProvider } from './components/theme-provider'
import { Navbar } from './components/Navbar'
import { Workspace } from "./components/Workspace"
import { CodeEditor } from "./components/CodeEditor"
import { useState, useCallback } from "react"

function App() {
  const [sidebarWidth, setSidebarWidth] = useState(250)
  const [isResizing, setIsResizing] = useState(false)

  const startResizing = useCallback(() => {
    setIsResizing(true)
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
  }, [])

  const resize = useCallback(
    (e: React.MouseEvent) => {
      if (isResizing) {
        const newWidth = e.clientX
        if (newWidth >= 200 && newWidth <= 400) {
          setSidebarWidth(newWidth)
        }
      }
    },
    [isResizing]
  )

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div 
        className="h-screen flex flex-col bg-background text-foreground overflow-hidden"
        onMouseMove={resize}
        onMouseUp={stopResizing}
        onMouseLeave={stopResizing}
      >
        <Navbar />
        <main className="flex-1 flex overflow-hidden">
          <div style={{ width: sidebarWidth, minWidth: sidebarWidth }} className="h-full flex-shrink-0">
            <Workspace />
          </div>
          
          <div 
            className="w-1 bg-border hover:bg-primary cursor-col-resize transition-colors flex-shrink-0"
            onMouseDown={startResizing}
          />
          
          <div className="flex-1 h-full overflow-hidden">
            <CodeEditor />
          </div>
        </main>
      </div>
    </ThemeProvider>
  )
}

export default App

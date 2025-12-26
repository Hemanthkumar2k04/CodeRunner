import Editor from "@monaco-editor/react"
import { useTheme } from "./theme-provider"

export function CodeEditor() {
  const { theme } = useTheme()

  return (
    <div className="h-full w-full bg-background">
      <Editor
        height="100%"
        defaultValue="# Write your code here"
        theme={theme === "dark" ? "vs-dark" : "light"}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          padding: { top: 16 },
        }}
      />
    </div>
  )
}

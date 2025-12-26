import { Folder, FileCode } from "lucide-react"

export function Workspace() {
  return (
    <div className="h-full w-full bg-sidebar p-4 border-r">
      <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-sidebar-foreground">
        <Folder className="h-4 w-4" />
        <span>Project Files</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded hover:bg-sidebar-accent">
          <FileCode className="h-4 w-4" />
          <span>main.py</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded hover:bg-sidebar-accent">
          <FileCode className="h-4 w-4" />
          <span>utils.py</span>
        </div>
      </div>
    </div>
  )
}

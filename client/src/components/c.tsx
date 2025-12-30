import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Console() {
  const output = useEditorStore(state => state.output);
  const clearOutput = useEditorStore(state => state.clearOutput);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="h-full w-full bg-surface border-t border-border flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/10">
        <div className="text-sm font-medium">Console</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => clearOutput()}>
            Clear
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3" ref={containerRef}>
        <ScrollArea className="h-full">
          <pre className="whitespace-pre-wrap break-words text-sm font-mono">
            {output.map((o, idx) => (
              <div key={o.timestamp + '-' + idx} className={
                o.type === 'stderr' ? 'text-rose-400' : o.type === 'system' ? 'text-muted-foreground' : 'text-foreground'
              }>
                {o.data}
              </div>
            ))}
          </pre>
        </ScrollArea>
      </div>
    </div>
  );
}
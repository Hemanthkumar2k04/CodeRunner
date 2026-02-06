import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function KeyboardShortcutsModal({ open, onOpenChange }: Props) {
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  const shortcuts = [
    // {
    //   id: "save",
    //   action: "Save file",
    //   keys: isMac ? "Cmd + S" : "Ctrl + S",
    // },
    {
      id: "run",
      action: "Run code",
      keys: isMac ? "Cmd + Enter" : "Ctrl + Enter",
    },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogTitle>Keyboard Shortcuts</DialogTitle>
        <DialogDescription className="mb-4">
          Helpful shortcuts for the editor.
        </DialogDescription>

        <div className="grid gap-3">
          {shortcuts.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="text-sm font-medium">{s.action}</div>
              <div className="text-xs font-mono text-muted-foreground">
                {s.keys}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default KeyboardShortcutsModal;

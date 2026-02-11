// client/src/components/FilePreview.tsx
import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileIcon } from '@/components/FileIcon';
import { Image as ImageIcon } from 'lucide-react';

interface FilePreviewProps {
  fileName: string;
  content: string;
  isBinary?: boolean;
}

export function FilePreview({ fileName, content, isBinary }: FilePreviewProps) {
  // Debug logging
  console.log('[FilePreview]', { fileName, isBinary, contentLength: content?.length, contentPreview: content?.substring(0, 50) });
  
  // Detect file type
  const fileType = useMemo(() => {
    if (/\.(png|jpg|jpeg|gif|bmp|svg|webp|ico)$/i.test(fileName)) {
      return 'image';
    }
    if (/\.(csv|tsv)$/i.test(fileName)) {
      return 'csv';
    }
    if (/\.(pdf)$/i.test(fileName)) {
      return 'pdf';
    }
    if (isBinary) {
      return 'binary';
    }
    return 'text';
  }, [fileName, isBinary]);

  // Parse CSV content
  const csvData = useMemo(() => {
    if (fileType !== 'csv' || !content) return null;
    
    try {
      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length === 0) return null;
      
      const delimiter = content.includes('\t') ? '\t' : ',';
      const rows = lines.map(line => {
        // Simple CSV parsing (doesn't handle quoted commas)
        return line.split(delimiter).map(cell => cell.trim());
      });
      
      return {
        headers: rows[0],
        data: rows.slice(1),
      };
    } catch (error) {
      console.error('Failed to parse CSV:', error);
      return null;
    }
  }, [content, fileType]);

  // Render image
  if (fileType === 'image') {
    console.log('[FilePreview] Rendering image:', { fileName, hasContent: !!content, isDataUrl: content?.startsWith('data:') });
    
    return (
      <div className="flex flex-col h-full bg-muted/20">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background/80">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Image Preview</span>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex items-center justify-center p-8 min-h-full">
            {content ? (
              <img
                src={content}
                alt={fileName}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                style={{ maxHeight: 'calc(100vh - 200px)' }}
                onError={(e) => {
                  console.error('[FilePreview] Image load error:', e);
                  console.error('[FilePreview] Image src:', content?.substring(0, 100));
                }}
                onLoad={() => console.log('[FilePreview] Image loaded successfully')}
              />
            ) : (
              <div className="text-muted-foreground">No image data available</div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Render CSV table
  if (fileType === 'csv' && csvData) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <FileIcon filename={fileName} size={16} />
            <span className="text-sm font-medium">CSV Table View</span>
            <span className="text-xs text-muted-foreground">
              ({csvData.data.length} rows)
            </span>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4">
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    {csvData.headers.map((header, i) => (
                      <th
                        key={i}
                        className="px-4 py-2 text-left font-medium border-b"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvData.data.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-muted/50">
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-4 py-2 border-b"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Render PDF placeholder
  if (fileType === 'pdf') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/20 p-8">
        <FileIcon filename={fileName} size={48} className="mb-4" />
        <h3 className="text-lg font-medium mb-2">{fileName}</h3>
        <p className="text-sm text-muted-foreground">
          PDF preview not available in editor
        </p>
      </div>
    );
  }

  // Render binary file placeholder
  if (fileType === 'binary') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/20 p-8">
        <FileIcon filename={fileName} size={48} className="mb-4" />
        <h3 className="text-lg font-medium mb-2">{fileName}</h3>
        <p className="text-sm text-muted-foreground">
          Binary file - preview not available
        </p>
      </div>
    );
  }

  // Should not reach here, but return null as fallback
  return null;
}

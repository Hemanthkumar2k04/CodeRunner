import { useMemo } from 'react';
import {
  getIconForFile,
  getIconForFolder,
  getIconForOpenFolder,
  DEFAULT_FILE,
  DEFAULT_FOLDER,
  DEFAULT_FOLDER_OPENED,
} from 'vscode-icons-ts';

interface FileIconProps {
  filename: string;
  isFolder?: boolean;
  isOpen?: boolean;
  className?: string;
  size?: number;
}

export function FileIcon({ 
  filename, 
  isFolder = false, 
  isOpen = false, 
  className = '',
  size = 16 
}: FileIconProps) {
  const iconName = useMemo(() => {
    if (isFolder) {
      return isOpen 
        ? getIconForOpenFolder(filename) || DEFAULT_FOLDER_OPENED
        : getIconForFolder(filename) || DEFAULT_FOLDER;
    }
    return getIconForFile(filename) || DEFAULT_FILE;
  }, [filename, isFolder, isOpen]);

  return (
    <img
      src={`/icons/${iconName}`}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ 
        minWidth: size, 
        minHeight: size,
        objectFit: 'contain'
      }}
      draggable={false}
    />
  );
}

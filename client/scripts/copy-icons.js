#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// List of icon files to copy
const icons = [
  'default_file.svg',
  'default_folder.svg',
  'default_folder_opened.svg',
  'default_root_folder.svg',
  'default_root_folder_opened.svg',
  'file_type_python.svg',
  'file_type_java.svg',
  'file_type_c.svg',
  'file_type_c2.svg',
  'file_type_c3.svg',
  'file_type_cheader.svg',
  'file_type_cpp.svg',
  'file_type_cpp2.svg',
  'file_type_cpp3.svg',
  'file_type_cppheader.svg',
  'file_type_js.svg',
  'file_type_js_official.svg',
  'file_type_typescript.svg',
  'file_type_typescript_official.svg',
  'file_type_typescriptdef.svg',
  'file_type_typescriptdef_official.svg',
  'file_type_rust.svg',
  'file_type_go.svg',
  'file_type_go_gopher.svg',
  'file_type_json.svg',
  'file_type_yaml.svg',
  'file_type_text.svg',
  'file_type_excel.svg',
];

const sourceDir = path.join(__dirname, '../node_modules/vscode-icons-ts/build/icons');
const targetDir = path.join(__dirname, '../public/icons');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`Created directory: ${targetDir}`);
}

// Copy each icon file
icons.forEach((icon) => {
  const sourcePath = path.join(sourceDir, icon);
  const targetPath = path.join(targetDir, icon);

  try {
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`Copied: ${icon}`);
    } else {
      console.warn(`Source file not found: ${icon}`);
    }
  } catch (err) {
    console.error(`Error copying ${icon}:`, err.message);
  }
});

// Rename file_type_excel.svg to file_type_csv.svg
const excelPath = path.join(targetDir, 'file_type_excel.svg');
const csvPath = path.join(targetDir, 'file_type_csv.svg');

try {
  if (fs.existsSync(excelPath)) {
    fs.renameSync(excelPath, csvPath);
    console.log('Renamed: file_type_excel.svg -> file_type_csv.svg');
  }
} catch (err) {
  console.error('Error renaming file:', err.message);
}

console.log('Icon setup completed!');

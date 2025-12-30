#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting CodeRunner Setup...${NC}"

# Ensure script is not run with sudo
if [ "$EUID" -eq 0 ]; then 
  echo -e "${YELLOW}⚠️  Please do not run this script with sudo!${NC}"
  echo -e "${YELLOW}Run without sudo to avoid permission issues.${NC}"
  exit 1
fi

# Check and load nvm if available
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
  echo -e "${BLUE}📌 Using NVM to manage Node.js versions...${NC}"
  nvm use
fi

# Clean up any node_modules with permission issues
echo -e "\n${BLUE}🧹 Cleaning up old node_modules...${NC}"
rm -rf server/node_modules client/node_modules
rm -rf server/package-lock.json client/package-lock.json

# 1. Install Server Dependencies
echo -e "\n${BLUE}📦 Installing Server Dependencies...${NC}"
cd server || exit 1
npm ci
cd ..

# 2. Install Client Dependencies
echo -e "\n${BLUE}📦 Installing Client Dependencies...${NC}"
cd client || exit 1
npm ci
cd ..

# 3. Build Docker Runtimes
echo -e "\n${BLUE}🐳 Building Docker Runtimes...${NC}"

# Python
echo -e "${GREEN}Building Python Runtime...${NC}"
cd runtimes/python || exit 1
docker build -t python-runtime .
cd ../..

# C++
echo -e "${GREEN}Building C++ Runtime...${NC}"
cd runtimes/cpp || exit 1
docker build -t cpp-runtime .
cd ../..

# Java
echo -e "${GREEN}Building Java Runtime...${NC}"
cd runtimes/java || exit 1
docker build -t java-runtime .
cd ../..

# Node.js
echo -e "${GREEN}Building Node.js Runtime...${NC}"
cd runtimes/javascript || exit 1
docker build -t node-runtime .
cd ../..

# MySQL
echo -e "${GREEN}Building MySQL Runtime...${NC}"
cd runtimes/mysql || exit 1
docker build -t mysql-runtime .
cd ../..

echo -e "\n${GREEN}✅ Setup Complete!${NC}"
echo -e "To start the server:  ${BLUE}cd server && npm run dev${NC}"
echo -e "To start the client:  ${BLUE}cd client && npm run dev${NC}"

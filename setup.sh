#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting CodeRunner Setup...${NC}"

# 1. Install Server Dependencies
echo -e "\n${BLUE}📦 Installing Server Dependencies...${NC}"
cd server
npm install
cd ..

# 2. Install Client Dependencies
echo -e "\n${BLUE}📦 Installing Client Dependencies...${NC}"
cd client
npm install
cd ..

# 3. Build Docker Runtimes
echo -e "\n${BLUE}🐳 Building Docker Runtimes...${NC}"

# Python
echo -e "${GREEN}Building Python Runtime...${NC}"
cd runtimes/python
docker build -t python-runtime .
cd ../..

# C++
echo -e "${GREEN}Building C++ Runtime...${NC}"
cd runtimes/cpp
docker build -t cpp-runtime .
cd ../..

# Java
echo -e "${GREEN}Building Java Runtime...${NC}"
cd runtimes/java
docker build -t java-runtime .
cd ../..

# Node.js
echo -e "${GREEN}Building Node.js Runtime...${NC}"
cd runtimes/javascript
docker build -t node-runtime .
cd ../..

echo -e "\n${GREEN}✅ Setup Complete!${NC}"
echo -e "To start the server:  ${BLUE}cd server && sudo npm run dev${NC}"
echo -e "To start the client:  ${BLUE}cd client && sudo npm run dev${NC}"

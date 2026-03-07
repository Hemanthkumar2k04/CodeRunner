# --- Stage 1: Build the React client ---
FROM node:20-alpine AS builder
WORKDIR /app/client

COPY client/package*.json ./
# The postinstall script requires scripts/copy-icons.js
COPY client/scripts/ ./scripts/
RUN npm ci --legacy-peer-deps

COPY client/ ./
RUN npm run build


# --- Stage 2: Nginx web server ---
FROM nginx:alpine AS production

COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

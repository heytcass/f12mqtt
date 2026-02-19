# --- Stage 1: Build TypeScript backend ---
FROM node:22-alpine AS backend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ src/
RUN npx tsc

# --- Stage 2: Build React frontend ---
FROM node:22-alpine AS frontend-build
WORKDIR /app/ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY ui/ .
RUN npm run build

# --- Stage 3: Production runtime ---
FROM node:22-alpine
WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled backend
COPY --from=backend-build /app/dist/ dist/

# Copy built frontend into dist/public (where @fastify/static looks)
COPY --from=frontend-build /app/dist/public/ dist/public/

# Create data directory
RUN mkdir -p /data/recordings

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV RECORDINGS_DIR=/data/recordings
ENV DB_PATH=/data/config.db
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

VOLUME ["/data"]

CMD ["node", "dist/index.js"]

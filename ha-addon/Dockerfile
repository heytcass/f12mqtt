ARG BUILD_FROM
FROM ${BUILD_FROM}

# Install Node.js 22
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Install backend dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled backend + built frontend
COPY dist/ dist/

RUN mkdir -p /data/recordings

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", "dist/index.js"]

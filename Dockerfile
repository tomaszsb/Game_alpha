# Game Alpha - Multi-Device Board Game
# Build: docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t game-alpha .
# Run: docker run -p 3000:3000 -p 3001:3001 -v game-data:/app/data game-alpha

FROM node:20-alpine

# Build argument for version tracking
ARG GIT_COMMIT=unknown

WORKDIR /app

# Copy package files
COPY package*.json ./

# Pin npm to v10 explicitly. Deliberately NOT @latest: npm v11 (Oct 2025)
# added an install-script approval prompt that produces deploy-log warnings
# for @swc/core / esbuild / puppeteer postinstall scripts on every build.
# Stay on v10 until we want to adopt v11's approval mechanism in package.json.
RUN npm install -g npm@10

# Install ALL dependencies (including build tools)
# Skip Puppeteer browser download — not needed in production
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci

# Copy source code
COPY . .

# Build the frontend with git commit passed as env var
# ENV must be set in the same RUN command for Vite to see it
RUN VITE_GIT_COMMIT=${GIT_COMMIT} npm run build

# Copy SOURCE_FILES as immutable baseline for reset functionality
RUN cp -r dist/data/SOURCE_FILES dist/data/BASELINE

# Create data directory for persistence
RUN mkdir -p /app/data

# Set environment variables for production paths
ENV DATA_DIR=/app/data
ENV LOG_FILE=/app/data/visitors.log
ENV GAMES_FILE=/app/data/games.json
ENV DIST_PATH=/app/dist

# Note: Non-root user (USER node) deferred — requires host volume permission
# changes in deploy.sh. Container is already hardened via --read-only,
# --cap-drop ALL, and --no-new-privileges in deploy.sh.

# Expose single port (Express serves both API and static files)
EXPOSE 3001

# Volume for persistent data (games, logs)
VOLUME /app/data

# Start the server (serves both API and frontend)
CMD ["node", "server/server.js"]

# Game Alpha - Multi-Device Board Game
# Build: docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t game-alpha .
# Run: docker run -p 3000:3000 -p 3001:3001 -v game-data:/app/data game-alpha

FROM node:20-alpine

# Unraid Docker UI metadata — replaces the generic third-party cog with the
# project logo and gives the container a clickable Web UI link. The icon is
# served by this very container (public/images/logo.png -> dist on build).
LABEL net.unraid.docker.icon="https://game.unravelcodes.com/images/logo.png" \
      net.unraid.docker.webui="https://game.unravelcodes.com" \
      org.opencontainers.image.title="Unravel Codes: The Game" \
      org.opencontainers.image.description="Multi-player board game simulating NYC construction permitting" \
      org.opencontainers.image.url="https://game.unravelcodes.com" \
      org.opencontainers.image.source="https://github.com/tomaszsb/Game_alpha"

# Build argument for version tracking
ARG GIT_COMMIT=unknown

WORKDIR /app

# Copy package files
COPY package*.json ./

# Update npm to the latest v11.x. npm v11 (Oct 2025) added an install-script
# allow-list as a supply-chain attack mitigation; trusted packages are listed
# in the `allowScripts` field in package.json so postinstall scripts run
# without warnings. Pinned to the v11 line (not `@latest`) because npm v12
# raised its engine requirement to Node >=22, which this image (node:20-alpine)
# doesn't satisfy — `@latest` broke the build the day npm 12.0.0 shipped
# (2026-07-09). Bump this pin (and the base image, if wanted) deliberately,
# not automatically.
RUN npm install -g npm@11

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

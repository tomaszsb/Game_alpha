# Game Alpha - Multi-Device Board Game
# Build: docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t game-alpha .
# Run: docker run -p 3000:3000 -p 3001:3001 -v game-data:/app/data game-alpha

FROM node:20-alpine

# Build argument for version tracking
ARG GIT_COMMIT=unknown

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including build tools)
RUN npm ci

# Copy source code
COPY . .

# Build the frontend with git commit passed as env var
# ENV must be set in the same RUN command for Vite to see it
RUN VITE_GIT_COMMIT=${GIT_COMMIT} npm run build

# Create data directory for persistence
RUN mkdir -p /app/data

# Set environment variables for production paths
ENV DATA_DIR=/app/data
ENV LOG_FILE=/app/data/visitors.log
ENV GAMES_FILE=/app/data/games.json
ENV DIST_PATH=/app/dist

# Expose single port (Express serves both API and static files)
EXPOSE 3001

# Volume for persistent data (games, logs)
VOLUME /app/data

# Start the server (serves both API and frontend)
CMD ["node", "server/server.js"]

# Game Alpha - Multi-Device Board Game
# Build: docker build -t game-alpha .
# Run: docker run -p 3000:3000 -p 3001:3001 -v game-data:/app/data game-alpha

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including build tools)
RUN npm ci

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Install serve for static file hosting
RUN npm install -g serve

# Create data directory for persistence
RUN mkdir -p /app/data

# Set environment variables for production paths
ENV DATA_DIR=/app/data
ENV LOG_FILE=/app/data/visitors.log
ENV GAMES_FILE=/app/data/games.json

# Expose ports (frontend + backend)
EXPOSE 3000 3001

# Volume for persistent data (games, logs)
VOLUME /app/data

# Start both servers
CMD ["sh", "-c", "node server/server.js & serve -s dist -l 3000"]

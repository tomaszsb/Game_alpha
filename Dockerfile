# Game Alpha - Multi-Device Board Game
# Build: docker build -t game-alpha .
# Run: docker run -p 3000:3000 -p 3001:3001 game-alpha

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Install serve for static file hosting
RUN npm install -g serve

# Expose ports (frontend + backend)
EXPOSE 3000 3001

# Start both servers
CMD ["sh", "-c", "node server/server.js & serve -s dist -l 3000"]

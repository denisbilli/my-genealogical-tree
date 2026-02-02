# Stage 1: Build Frontend
FROM node:22-alpine AS client-build

WORKDIR /app/client

COPY client/package*.json ./
RUN npm install

COPY client/ ./
RUN npm run build

# Stage 2: Build Backend & Serve
FROM node:22-alpine

WORKDIR /app

# Create uploads directory
RUN mkdir -p uploads

# Copy root package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy backend code
COPY server.js ./
COPY server/ ./server/

# Copy built frontend from previous stage
COPY --from=client-build /app/client/build ./client/build

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3060

# Expose port
EXPOSE 3060

# Start command
CMD ["node", "server.js"]

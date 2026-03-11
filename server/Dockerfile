# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install production dependencies only
# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production && npm cache clean --force

# Copy application source code
COPY . .

# Create uploads directory with proper permissions
RUN mkdir -p uploads && chown -R node:node uploads

# Create non-root user (node user already exists in node image)
# Change ownership of application files to node user
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose port 5000
EXPOSE 5000

# Health check (optional but recommended)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "server.js"]

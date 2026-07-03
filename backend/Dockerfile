FROM node:20-alpine

WORKDIR /app

# Install PostgreSQL client for schema initialization
RUN apk add --no-cache postgresql-client

# Copy package files
COPY package*.json ./

# Install dependencies
# For production: use npm ci --only=production to skip devDependencies
# For development: use npm ci to install all dependencies
RUN npm ci

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the application
CMD ["npm", "start"]

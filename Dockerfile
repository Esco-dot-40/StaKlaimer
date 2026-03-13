# Use official Playwright image (comes with all browser dependencies pre-installed)
FROM mcr.microsoft.com/playwright:v1.42.1-focal

# Set working directory
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production
ENV RAILWAY_ENVIRONMENT=true

# Copy package files and install
COPY package*.json ./
RUN npm install

# Copy all application files
COPY . .

# Create user data directory in /tmp for permissions
RUN mkdir -p /tmp/vanguard_browser && chmod -R 777 /tmp/vanguard_browser

# Expose the port Railway uses
EXPOSE 8080

# Start the application
CMD ["npm", "start"]

# Use the official Playwright image which has all dependencies pre-installed
FROM mcr.microsoft.com/playwright:v1.42.1-focal

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Expose the port
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]

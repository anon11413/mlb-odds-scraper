# Use a slim Node image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (ignoring playwright for the server)
RUN npm install --production

# Copy the rest of the application
COPY . .

# Set environment variables
ENV PORT=3001
ENV NODE_ENV=production

# Expose the port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]

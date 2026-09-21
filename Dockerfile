FROM node:22-alpine

WORKDIR /app

# Install production dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy application files, backend server, admin panel, and static assets
COPY index.html styles.css ./
COPY assets ./assets/
COPY images ./images/
COPY src ./src/
COPY vendor ./vendor/
COPY admin ./admin/
COPY server ./server/

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Environment configuration
ENV PORT=80
ENV NODE_ENV=production
ENV DB_PATH=/app/data/aviator.db
ENV ADMIN_PASSWORD=admin123

EXPOSE 80

CMD ["node", "server/index.js"]

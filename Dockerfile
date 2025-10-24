# Use official Node.js LTS
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY src ./src
# If you rely on a local service account file, uncomment the next line
# COPY serviceAccountKey.json ./serviceAccountKey.json

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "src/index.js"]

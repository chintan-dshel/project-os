# Stage 1: Build UI
FROM node:20-alpine AS build-ui
WORKDIR /ui
COPY project-os-ui/package.json ./
RUN npm install
COPY project-os-ui/ .
RUN npm run build

# Stage 2: API — serves both API routes and built UI static files
FROM node:20-alpine
WORKDIR /app
COPY project-os/package.json ./
RUN npm install --omit=dev
COPY project-os/ .
# Copy built UI into the directory Express will serve as static files
COPY --from=build-ui /ui/dist ./public
EXPOSE 3000
# Migrations run at container start against DATABASE_URL; safe to re-run (idempotent)
CMD ["sh", "-c", "node migrate.js && node src/index.js"]

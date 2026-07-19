# NestJS Prisma ORM — security-research 2/6 variant
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY prisma ./prisma
RUN npm install --omit=dev --no-audit --no-fund
RUN npx prisma generate
COPY --from=build /app/dist ./dist
EXPOSE 3002
CMD ["node", "dist/main.js"]

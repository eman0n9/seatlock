FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_MODE=real
ARG NEXT_PUBLIC_PROFILE_API_MODE=real
ARG NEXT_PUBLIC_PURCHASE_API_MODE=real
ARG NEXT_PUBLIC_API_URL=http://localhost:8082
ARG NEXT_PUBLIC_GRAPHQL_URL=http://localhost:8082/graphql
ARG NEXT_PUBLIC_WS_URL=ws://localhost:8081

ENV NEXT_PUBLIC_API_MODE=$NEXT_PUBLIC_API_MODE \
    NEXT_PUBLIC_PROFILE_API_MODE=$NEXT_PUBLIC_PROFILE_API_MODE \
    NEXT_PUBLIC_PURCHASE_API_MODE=$NEXT_PUBLIC_PURCHASE_API_MODE \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_GRAPHQL_URL=$NEXT_PUBLIC_GRAPHQL_URL \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

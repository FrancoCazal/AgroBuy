FROM node:20-alpine AS build

WORKDIR /app

ENV CI=1
ENV npm_config_fund=false
ENV npm_config_audit=false

COPY package.json ./
RUN npm install --no-package-lock

COPY tsconfig.json tsconfig.node.json vite.config.ts index.html components.json ./
COPY src/ src/
COPY public/ public/

ARG VITE_API_BASE
ENV VITE_API_BASE=${VITE_API_BASE}
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

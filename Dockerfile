# 1단계: 빌드
FROM node:20-alpine AS builder
WORKDIR /app

# 🔥 빌드 타임 변수 전달
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .

# 💡 이 타이밍에 .env 생성
RUN echo "VITE_API_BASE_URL=$VITE_API_BASE_URL" > .env

RUN npm install && npm run build

# 2단계: Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

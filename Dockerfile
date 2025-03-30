FROM node:20-alpine
WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm install

# 소스 복사
COPY . .

# 개발 서버 실행
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

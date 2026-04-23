FROM node:20-alpine
WORKDIR /app
COPY .npmrc ./
COPY package.json ./
RUN npm config set registry https://registry.npmmirror.com/ && npm config set strict-ssl false && npm install --omit=dev --force --legacy-peer-deps || npm config set registry https://mirrors.aliyun.com/npm/ && npm install --omit=dev --force --legacy-peer-deps || true
COPY index.js ./
EXPOSE 9092
CMD ["node", "index.js"]

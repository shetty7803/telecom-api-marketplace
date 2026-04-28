FROM node:20-alpine
WORKDIR /app
COPY .npmrc ./
COPY package.json ./
RUN npm config set registry https://registry.npmmirror.com/ && npm config set strict-ssl false && npm install --omit=dev --force --legacy-peer-deps
COPY index.js ./
COPY plan-service.wsdl ./
EXPOSE 9091
CMD ["node", "index.js"]

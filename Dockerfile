FROM node:latest

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build --workspace=frontend

EXPOSE 3000

CMD ["node", "backend/server.js"]
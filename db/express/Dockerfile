FROM node:16-alpine

WORKDIR /app

COPY package*.json tsconfig.json ./

RUN npm install

COPY . .
EXPOSE 4000

CMD ["npm", "run", "dev"]

#syntax=docker/dockerfile:1.7-labs
FROM node:22-alpine


RUN mkdir /app

COPY ["package.json", "package-lock.json", "/app/"]
#COPY ["node_modules", "/app/"]
COPY --parents */*.json /app/
COPY node_modules/ /app/node_modules
COPY node_modules/.bin/ /app/node_modules/.bin
COPY db/ /app/db
COPY ./tsconfig.json /app/tsconfig.json
 
COPY --parents src/**/*.ts /app/
COPY --parents src/**/*.js /app/
COPY --parents src/**/*.json /app/
#packages/**/package.json ./

COPY docker-dev-tools/app/* /app

WORKDIR /app

RUN rm .git/ -rf

ENTRYPOINT ["/app/entrypoint.sh"]
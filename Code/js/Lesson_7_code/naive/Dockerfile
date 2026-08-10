FROM node:22
WORKDIR /app
COPY . .
RUN npm install
ENV DATABASE_URL=postgresql://learner:lesson4@localhost:55432/bookmarks
EXPOSE 8000
CMD ["npx", "nodemon", "server.js"]

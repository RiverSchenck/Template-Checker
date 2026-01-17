# Build stage
FROM node:18-alpine as build

WORKDIR /app

COPY . ./

RUN npm install
RUN npm run build

# Serve stage
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

#BUILDING: docker build -t riverschenck/react_frontend:0.0.2.RELEASE .

#LOCAL TESTING: docker container run -d -p 6000:80 riverschenck/react_frontend:0.0.2.RELEASE
# -p local mapped port:actual defined app port
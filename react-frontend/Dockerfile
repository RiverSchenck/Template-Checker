# Build stage
FROM node:24-alpine AS build

WORKDIR /app

COPY . ./

RUN npm install

# VITE_* values are baked into the bundle at build time. CI passes them with
# `fly deploy --build-arg`; a local deploy without build args falls back to .env.
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN npm run build

# Serve stage
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

#BUILDING: docker build -t riverschenck/react_frontend:0.0.2.RELEASE .

#LOCAL TESTING: docker container run -d -p 6000:80 riverschenck/react_frontend:0.0.2.RELEASE
# -p local mapped port:actual defined app port
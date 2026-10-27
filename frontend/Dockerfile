FROM nginx:alpine

# nginx sustituye ${BACKEND_URL} al arrancar (plantillas de la imagen oficial).
# Por defecto vale para docker compose; en Unraid se pone http://IP-UNRAID:PUERTO-BACKEND.
ENV BACKEND_URL=http://backend:8000

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY public/ /usr/share/nginx/html/

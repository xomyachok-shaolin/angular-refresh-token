# Базовый образ Nginx
FROM nginx:alpine

# Устанавливаем зависимости для envsubst
RUN apk add --no-cache bash gettext

# Копируем собранное Angular приложение в директорию Nginx
COPY ./dist/angular-refresh-token /usr/share/nginx/html

# Копируем шаблон Nginx конфигурации
COPY ./default.conf.template /etc/nginx/templates/default.conf.template

# Экспонируем порты
EXPOSE 80 443

# Запускаем Nginx с заменой переменных окружения только для BACKEND_URL и GEOSERVER_URL
CMD ["/bin/bash", "-c", "envsubst '${BACKEND_URL} ${GEOSERVER_URL} ${DADATA_TOKEN}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && envsubst '${DADATA_TOKEN}' < /usr/share/nginx/html/assets/config.json.template > /usr/share/nginx/html/assets/config.json && exec nginx -g 'daemon off;'"]

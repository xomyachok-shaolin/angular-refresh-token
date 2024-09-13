# Базовый образ Nginx
FROM nginx:alpine

# Копируем собранное Angular приложение в директорию Nginx
COPY ./dist/angular-refresh-token /usr/share/nginx/html

# Копируем Nginx конфигурацию
COPY ./default.conf /etc/nginx/conf.d/default.conf

# Экспонируем порты
EXPOSE 80 443

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]

# Stage 0: Используем Node.js базовый образ
FROM node:alpine AS build

# Устанавливаем PNPM
RUN npm install -g pnpm

# Настраиваем глобальную директорию для PNPM
# Ручная установка PNPM_HOME и обновление PATH
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN mkdir -p $PNPM_HOME

# Устанавливаем Angular CLI глобально
RUN pnpm add -g @angular/cli

# Устанавливаем зависимости
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN pnpm install

# Копируем исходный код Angular в контейнер
COPY . .

# Собираем Angular приложение
RUN pnpm run build

# Stage 1: Используем базовый образ Nginx для деплоя
FROM nginx:alpine

# Копируем файлы сборки Angular в директорию сервера Nginx
COPY --from=build /app/dist/angular-refresh-token /usr/share/nginx/html

# Копируем конфигурацию Nginx
COPY default.conf /etc/nginx/conf.d/default.conf

# Создаем директорию для SSL сертификатов
RUN mkdir -p /etc/nginx/ssl

# Копируем SSL сертификаты и ключи
COPY nginx_certificates/selfsigned.crt /etc/nginx/ssl/
COPY nginx_certificates/selfsigned.key /etc/nginx/ssl/

# Экспонируем порты 80 и 443
EXPOSE 80 443

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]

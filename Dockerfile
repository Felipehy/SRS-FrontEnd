FROM node:22-alpine AS build
WORKDIR /app

# Modelo de PROXY: o front chama a MESMA origem (/api) e o nginx repassa ao backend.
# Por isso a URL embutida no bundle é sempre "/api" — o endereço interno da API NÃO
# fica aqui, e sim no runtime (env API_UPSTREAM do nginx, no estágio de baixo).
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Logout: o botao "Sair" vai para o /logout do nginx (que limpa o cookie do ALB
# e redireciona pro /logout do Cognito). Ver nginx.conf.
ARG VITE_COGNITO_LOGOUT_URL=/logout
ENV VITE_COGNITO_LOGOUT_URL=$VITE_COGNITO_LOGOUT_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

# Endereço INTERNO da API (nginx→backend, dentro do firewall). Trocável em runtime
# pela env do ECS (task definition), SEM rebuild — nenhum endereço real fica na imagem.
ENV API_UPSTREAM=0.0.0.0:8080

# Só esta var é substituída no template (as do nginx, $host/$uri, ficam intactas).
ENV NGINX_ENVSUBST_FILTER=API_UPSTREAM

# nginx.conf é um TEMPLATE: o entrypoint do nginx roda envsubst e gera o default.conf
COPY nginx.conf /etc/nginx/templates/default.conf.template

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

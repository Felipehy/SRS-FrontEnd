# SRS — Sistema de Reservas (Frontend)

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-nginx-2496ED?logo=docker&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-ECS%20%7C%20ECR%20%7C%20Cognito-FF9900?logo=amazonwebservices&logoColor=white)

Frontend do sistema interno de reservas da SIURB. Os usuários reservam **salas de reunião**, o **auditório** e **veículos da frota**. A Divisão Administrativa aprova ou reprova cada pedido, e um painel de administração gerencia usuários, grupos, salas e departamentos.

Este repositório tem só o frontend. A API REST (Spring Boot) fica em um repositório separado.

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Perfis de acesso](#perfis-de-acesso)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Destaques técnicos](#destaques-técnicos)
- [Como rodar localmente](#como-rodar-localmente)
- [Como usar](#como-usar)
- [Como subir (deploy)](#como-subir-deploy)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Endpoints consumidos](#endpoints-consumidos)

---

## Funcionalidades

### Reservas
- **Calendário único** para as três categorias (salas, auditório e frota), com visão de **mês, semana ou dia**, filtro por categoria, busca e lista de próximas reservas. Dois cliques em um dia abrem uma nova reserva.
- **Formulários com as regras de negócio validadas no cliente**:
  - **Sala de reunião**: só salas ativas, horário a partir das 07:00, justificativa obrigatória se passar das 19:00, pedido de café e água.
  - **Auditório**: até 100 pessoas (internas e público externo), abertura antecipada com motivo, telão, som e **coffee break** com janelas de montagem e serviço.
  - **Frota**: endereços de saída e destino, viagem de volta opcional, justificativa para sair do município, limite de passageiros (4 no carro, 15 na VAN) e justificativa para usar a VAN.
- **Conflito de horário**: em salas e no auditório, uma reserva **aprovada** bloqueia o mesmo horário.
- **Minhas reservas**: painel paginado com filtro por data e tipo, status e detalhes de cada pedido.
- **Ciclo de vida**: `ENVIADA_PARA_ANALISE` → `APROVADA` / `REPROVADA` → `FINALIZADA`. A reserva também pode ficar `CANCELADA`.

### Aprovação (Divisão Administrativa)
- Lista de todas as reservas com busca.
- Aprovar ou reprovar uma reserva (com motivo).
- Aprovar ou recusar o café/coffee break. Essa decisão pode ser revista depois.
- Cancelar reservas aprovadas, com motivo.

### Painel Admin
| Seção | O que faz |
|---|---|
| **Logs** | Auditoria paginada: quem alterou o quê, de onde (IP) e quando |
| **Usuários** | CRUD de usuários, vínculo com departamento, grupos, **reset de senha e de MFA** (via Cognito) |
| **Grupos** | CRUD de grupos (nome, grupo do Cognito, cor, descrição) e lista de membros |
| **Salas** | Ativar ou desativar salas para reserva |
| **Departamentos** | CRUD de departamentos |
| **SMTP** | Ligar ou desligar o envio de e-mails |

### Experiência do usuário
- **Tutorial guiado** no primeiro acesso: um overlay que destaca cada elemento da tela.
- **Personalização**: cor de cada categoria, foto de perfil (upload com barra de progresso) e layout de navegação (barra superior ou lateral). As preferências ficam salvas no backend.
- **Tema claro e escuro**.
- **Troca de perfil** para quem pertence a mais de um grupo.
- Layout responsivo.

---

## Perfis de acesso

O perfil vem dos grupos do usuário no **Amazon Cognito**. Quem tem mais de um grupo troca de perfil pelo menu da conta.

| Perfil | Tela inicial | O que pode fazer |
|---|---|---|
| **Geral** | Início | Usa o calendário, cria reservas e cancela as próprias |
| **Frotas** | Gestão de Frotas | Só a tela de gestão de frotas (em construção) |
| **DA** | Painel DA | Administração: aprova, reprova, decide o café e cancela |
| **Admin** | Início | Tudo, mais o Painel Admin. Nos formulários, não fica preso às regras de data, horário e limites |

Documentação completa: [docs/PERFIS-RESUMO.md](docs/PERFIS-RESUMO.md) (resumo) e [docs/PERFIS.md](docs/PERFIS.md) (matrizes de permissão, regras e onde cada uma está no código).

> O controle de acesso no frontend serve à **experiência de uso** (navegação, rotas, formulários). A autorização de verdade acontece no backend.

---

## Stack

| Camada | Tecnologias |
|---|---|
| UI | React 18, TypeScript (strict), Tailwind CSS 4, Radix UI / shadcn/ui, lucide-react |
| Roteamento | React Router 7 (memory router, rotas carregadas sob demanda) |
| Dados | axios, com interceptor que padroniza os erros da API |
| Datas | date-fns, react-day-picker |
| Build | Vite 6 |
| Infra | Docker (multi-stage) + nginx, AWS ECR, ECS, ALB, Cognito, CloudFront |
| CI/CD | GitHub Actions com autenticação OIDC na AWS (sem chaves de acesso fixas) |

---

## Arquitetura

```
Navegador
   │ HTTPS
   ▼
CloudFront
   │
   ▼
Application Load Balancer ── autenticação OIDC com o Amazon Cognito (Hosted UI)
   │  injeta os headers x-amzn-oidc-* em toda requisição autenticada
   ▼
nginx  (container no ECS, porta 8080)
   ├── /                → SPA (arquivos estáticos do build)
   ├── /auth/userinfo   → devolve os dados do usuário vindos dos headers do ALB
   ├── /logout          → expira o cookie do ALB e redireciona ao logout do Cognito
   └── /api/*           → proxy reverso para o backend (API_UPSTREAM)
                          + Authorization: Bearer <access token do Cognito>
```

- **Mesma origem**: o navegador só chama `/api`, então não há CORS e o endereço interno da API não aparece no bundle.
- **Login fora do app**: o ALB faz o desafio de login e o SPA só lê a identidade já validada.
- **Configuração em runtime**: o endereço da API (`API_UPSTREAM`) vem da task definition do ECS. Trocar o backend não exige rebuild da imagem.

---

## Destaques técnicos

- **Code splitting**: cada tela é um `lazy()` e o núcleo do React fica num chunk próprio (`react-vendor`) com cache longo.
- **Cache correto no nginx**: `/assets/` (com hash no nome) é imutável por 1 ano e `index.html` nunca é cacheado, então o navegador pega cada deploy novo.
- **Erros padronizados**: o interceptor do axios ([src/api/lib/api.ts](src/api/lib/api.ts)) converte as respostas do Spring (`ProblemDetail`, erros de validação por campo, texto simples) em um único formato `{ status, title, detail, fieldErrors }`.
- **Mapeamento tolerante de grupos**: o nome do grupo do Cognito é normalizado (sem acento, sem diferença de maiúsculas, prefixo e plural opcionais) antes de virar perfil ([src/app/auth/albAuth.ts](src/app/auth/albAuth.ts)).
- **Upload de arquivos grandes**: `client_max_body_size` e timeouts ajustados no nginx, para que o limite seja aplicado pelo backend e devolvido em JSON legível.
- **Logout completo**: limpa o cookie de sessão do ALB e a sessão do Cognito. Sem os dois, o usuário voltaria logado em silêncio.
- **Imagem enxuta**: o build multi-stage leva para a imagem final só o `dist/` e o nginx (com `server_tokens off`).
- **Deploy sem segredos no código**: o workflow assume uma role IAM via OIDC. Conta, região e cluster ficam em *secrets* e *variables* do GitHub.

---

## Como rodar localmente

### Pré-requisitos
- **Node.js 22+** e **npm**
- Opcional: o [backend](https://github.com/Felipehy/SRS-Backend) rodando em `http://localhost:8081`

### Passo a passo

```bash
git clone https://github.com/Felipehy/SRS-FrontEnd.git
cd SRS-FrontEnd

npm ci
cp .env.example .env.development   # no Windows (PowerShell): copy .env.example .env.development
npm run dev
```

O app sobe em **http://localhost:5173**.

### Sem backend e sem login
Em `npm run dev` não existe a sessão do ALB. O app entra com um **usuário fake de desenvolvimento** que tem os cinco grupos (geral, geral especial, frotas, DA e admin). Assim dá para navegar por todas as telas e testar cada perfil pelo menu **Trocar de perfil**.

Sem o backend, as telas abrem mas ficam vazias e as chamadas à API mostram erro. Com o backend em `localhost:8081`, o proxy do Vite ([vite.config.ts](vite.config.ts)) repassa o `/api` para ele, do mesmo jeito que o nginx faz em produção.

### Variáveis de ambiente

| Variável | Uso | Valor em produção |
|---|---|---|
| `VITE_API_BASE_URL` | Base das chamadas à API | `/api` |
| `VITE_COGNITO_LOGOUT_URL` | Destino do botão "Sair". Vazio: só recarrega a página | `/logout` |

O `.env.example` traz um modelo. Os arquivos `.env.*` reais não vão para o git.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com hot reload |
| `npm run build` | Gera o build de produção em `dist/` |
| `npm run preview` | Serve o `dist/` em `http://localhost:8080` |
| `npm run typecheck` | Checa os tipos com o `tsc` |

---

## Como usar

1. **Início**: atalho para o calendário e o painel **Minhas reservas**, com o status de cada pedido.
2. **Calendário**: escolha o dia, clique em **Nova reserva** (ou dê dois cliques no dia) e selecione **Sala de reunião**, **Auditório** ou **Frota**. A divisão e o servidor responsável já vêm preenchidos com os seus dados.
3. **Acompanhamento**: a reserva entra como *Enviada para análise* e muda para *Aprovada* ou *Reprovada* quando a DA decide.
4. **Administração** (perfil DA): abra uma reserva para aprovar, reprovar, decidir o café ou cancelar.
5. **Painel Admin** (perfil Admin): gerencie usuários, grupos, salas, departamentos, logs e SMTP.
6. **Configurações** (menu da conta): cores das categorias, foto de perfil e layout da navegação.

No primeiro acesso, o perfil Geral vê um tutorial que apresenta cada parte da tela.

---

## Como subir (deploy)

### Docker (local)

```bash
docker build -t srs-frontend .
docker run --rm -p 8080:8080 -e API_UPSTREAM=host.docker.internal:8081 srs-frontend
```

- `API_UPSTREAM` é o `host:porta` do backend, visto de dentro do container.
- A imagem foi feita para rodar **atrás do ALB com Cognito**. Sozinha, ela serve o app e o proxy, mas não há sessão de login. Para desenvolver, use `npm run dev`.

### Deploy na AWS (GitHub Actions → ECR → ECS)

Todo push na `main` dispara o [.github/workflows/deploy.yml](.github/workflows/deploy.yml), que:

1. valida se a configuração do deploy existe;
2. assume a role IAM via **OIDC**;
3. faz o build da imagem e o push para o **ECR** (tag = SHA do commit);
4. gera uma nova revisão da **task definition** com a imagem nova;
5. atualiza o serviço no **ECS** e espera ele estabilizar.

#### 1. Recursos na AWS

| Recurso | Nome esperado pelo workflow |
|---|---|
| Repositório ECR | `srs-frontend` |
| Família da task definition | `srs-frontend` |
| Container na task definition | `srs-frontend` (porta **8080**, env `API_UPSTREAM=<host-interno>:<porta>`) |
| Serviço ECS | `srs-frontend-service` |

Também são necessários:
- **Cognito User Pool** com um app client e o Hosted UI. Os grupos do User Pool definem os perfis (ex.: `siurb-geral`, `siurb-frotas`, `siurb-da`, `siurb-administrador`; o prefixo é opcional). A URL do app precisa estar em *Allowed sign-out URLs*.
- **ALB** com uma regra de listener `authenticate-cognito` antes do `forward` para o target group do serviço (porta 8080).
- Opcional: **CloudFront** na frente do ALB.
- **Role IAM para o GitHub Actions**, com trust policy para `token.actions.githubusercontent.com` restrita ao seu repositório e permissões de push no ECR, `ecs:DescribeTaskDefinition`, `ecs:RegisterTaskDefinition`, `ecs:UpdateService`, `ecs:DescribeServices` e `iam:PassRole` (para a role de execução da task).

#### 2. URL de logout do Cognito

No [nginx.conf](nginx.conf), em `location = /logout`, troque os valores de exemplo pelos do seu ambiente:

```nginx
return 302 "https://<dominio-do-hosted-ui>/logout?client_id=<client-id>&logout_uri=<url-do-app-encodada>";
```

#### 3. Configuração no GitHub

Em **Settings → Secrets and variables → Actions**:

| Tipo | Nome | Exemplo |
|---|---|---|
| Secret | `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::<account-id>:role/<role-do-oidc>` |
| Variable | `AWS_REGION` | `us-east-1` |
| Variable | `ECS_CLUSTER` | nome do cluster ECS |

Se faltar algum desses valores, o workflow para logo no primeiro passo com uma mensagem clara.

#### 4. Publicar

```bash
git push origin main
```

---

## Estrutura do projeto

```
.
├── .github/workflows/deploy.yml   # CI/CD: build → ECR → ECS
├── docs/                          # documentação dos perfis de acesso
├── src/
│   ├── api/
│   │   ├── lib/                   # cliente axios + interceptor de erros
│   │   └── service/               # um serviço por recurso da API
│   ├── app/
│   │   ├── auth/                  # perfis, permissões e leitura do usuário vindo do ALB
│   │   ├── components/            # componentes do app (ui/ = base shadcn/ui)
│   │   ├── context/               # auth, reservas, tema, cores, navegação, tutorial
│   │   ├── pages/                 # telas (admin/ e settings/ = seções de cada tela)
│   │   ├── tutorial/              # tutorial guiado de primeiro acesso
│   │   ├── types/  utils/
│   │   ├── routes.tsx             # rotas + perfis permitidos em cada uma
│   │   └── App.tsx
│   ├── config/                    # listas fixas dos formulários
│   ├── resources/img/             # logos e favicon
│   └── styles/                    # CSS global, tema e Tailwind
├── Dockerfile                     # build multi-stage (Node 22 → nginx)
├── nginx.conf                     # template: SPA, proxy /api, userinfo, logout
├── .env.example
└── vite.config.ts
```

---

## Endpoints consumidos

<details>
<summary>Ver a lista (todos relativos a <code>/api</code>)</summary>

| Recurso | Endpoints |
|---|---|
| Usuário logado | `GET /user` · `POST /user?navbar=` · `POST /user/color` · `PATCH /user/tutorial` · `GET /user/reservations` |
| Reservas | `GET /reservation?startTime=&endTime=` |
| Sala / Auditório / Frota | `/reservation/{meeting-room\|auditorium\|fleet-vehicle}`: `GET` · `GET /{id}` · `POST` · `DELETE /{id}` · `POST /{id}/approve` · `POST /{id}/reject` · `POST /cancel` · `POST /approve-coffee` · `POST /reject-coffee` |
| Salas | `GET /room` · `PATCH /room?id=&isActive=` |
| Departamentos | `GET /department` · `GET /department/{userId}` · `POST` · `PATCH` · `DELETE` |
| Anexos (foto de perfil) | `POST /anexos` · `GET /anexos/img` · `GET /anexos/imgs?email=` · `DELETE /anexos/delete` |
| Admin: usuários | `GET /admin/list-users` · `POST`/`PATCH`/`DELETE /admin/user` · `POST /admin/department` · `POST /admin/reset-password` · `POST /admin/reset-mfa` |
| Admin: grupos | `GET /admin/list-group` · `POST`/`PATCH`/`DELETE /admin/group` · `POST /admin/user/groups` · `POST /admin/user/add-group` · `POST /admin/user/remove-group` · `POST /admin/groups/users` |
| Logs | `GET /logs?offset=` |
| SMTP | `GET /smtp` · `POST /smtp?active=` |

</details>

---

## Créditos

Componentes base de [shadcn/ui](https://ui.shadcn.com/) (licença MIT). Veja [ATTRIBUTIONS.md](ATTRIBUTIONS.md).

## Autor

**Felipe Hajime Yamashita** · [LinkedIn](https://www.linkedin.com/in/felipe-hajime-yamashita/) · [GitHub](https://github.com/Felipehy)

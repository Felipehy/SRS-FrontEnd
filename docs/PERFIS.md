# Perfis de Acesso — SRS Frontend

Documento de referência do controle de acesso do sistema de reservas.
Descreve os **4 perfis**, o que cada um pode fazer, de onde vêm os grupos do usuário
e as regras que mudam conforme o perfil.

> Atualizado em: 2026-10-07

---

## 1. Visão geral

- O sistema tem **4 perfis**: `geral`, `frotas`, `da`, `admin`.
- O usuário pertence a **grupos**. Cada grupo tem um nome do Cognito (`groupCognito`)
  que o app traduz para um dos 4 perfis.
- Os grupos do usuário vêm do **`GET /api/user`** (campo `groups`). O vínculo
  usuário ↔ grupo é feito no **Painel Admin** (seções Usuários e Grupos).
- Um usuário pode ter **mais de um grupo**. Ele usa um de cada vez (o **grupo ativo**)
  e troca pelo menu da conta. Tudo no app (telas, navegação, regras de reserva) segue
  o **perfil do grupo ativo**. A única exceção é o cancelamento (seção 9).
- **Cada perfil tem a sua tela inicial** (`src/app/auth/roleHome.ts`):

| Perfil | Tela inicial | Rota |
|---|---|---|
| `geral` | Início | `/` |
| `frotas` | Gestão de Frotas | `/gestao-frotas` |
| `da` | Painel DA | `/da` |
| `admin` | Início | `/` |

### Rotas internas
O app usa *memory router*: a barra de endereço do navegador não muda e não dá para
abrir uma tela digitando a URL. O app sempre começa em `/`, e a guarda de rota
manda o usuário para a tela inicial do perfil ativo quando ele não tem acesso.

### Fluxo do perfil
```
GET /api/user → groups[]  →  groupCognito               →  perfil  →  nome exibido
                             "siurb-da"                  →  da      →  groupName do banco
                             "siurb-usuarios-gerais-especiais" → geral
```

---

## 2. Os 4 perfis

### `geral` — Usuário Geral
O usuário comum. Cria e acompanha as próprias reservas.
- **Pode:** usar o **Calendário** (Salas de Reunião, Auditório e Frota numa tela só)
  e **criar reservas** nas três categorias; cancelar as **próprias** reservas.
- **Vê o tutorial** de primeiro acesso (é o único perfil que vê).
- **Não pode:** aprovar/reprovar reservas, acessar a Gestão de Frotas nem o Painel Admin.

#### Grupo especial `siurb-usuarios-gerais-especiais`
Tem o perfil `geral`, mas **não é bloqueado por conflito com reserva já APROVADA**
(Salas e Auditório). Todas as outras regras continuam valendo.
- No banco, o `groupName` dele é o **mesmo** do usuário geral; só o `groupCognito`
  diferencia. Por isso a checagem é sempre pelo `groupCognito`, nunca pelo nome.

### `frotas` — Frotas
Perfil dedicado à frota. **Escopo enxuto por decisão de produto:** só a tela dele.
- **Pode:** acessar a **Gestão de Frotas** (`/gestao-frotas`, sua tela inicial —
  em construção).
- **Não pode:** ver a Home, o Calendário, a Administração nem o Painel Admin.

### `da` — DA (Divisão Administrativa)
Perfil de administração das reservas.
- **Pode:** acessar o **Painel DA** (`/da`, sua tela inicial — em construção) e a
  **Administração**, onde vê todas as reservas e:
  - **aprova / reprova** reservas;
  - **aprova / recusa o café** (a decisão do café pode ser alterada depois);
  - **cancela** reservas **aprovadas**, informando o motivo.
- **Não pode:** ver a Home nem o Calendário (não cria reservas), acessar a Gestão de
  Frotas nem o Painel Admin.

### `admin` — Administrador
Perfil máximo: enxerga tudo.
- **Pode:** tudo que os outros perfis podem **e** o **Painel Admin** (seção 5).
- **Nos formulários de reserva, ignora as regras** (seção 7), mas os campos
  obrigatórios continuam obrigatórios.

---

## 3. Matriz de permissões — por tela

| Tela / Rota | `geral` | `frotas` | `da` | `admin` |
|---|:--:|:--:|:--:|:--:|
| Início (`/`) | ✅ | ❌ | ❌ | ✅ |
| Painel DA (`/da`) | ❌ | ❌ | ✅ | ✅ |
| Calendário (`/calendario`) | ✅ | ❌ | ❌ | ✅ |
| Administração (`/administracao`) | ❌ | ❌ | ✅ | ✅ |
| Gestão de Frotas (`/gestao-frotas`) | ❌ | ✅ | ❌ | ✅ |
| Painel Admin (`/admin`) | ❌ | ❌ | ❌ | ✅ |
| Configurações (`/configuracoes`) | ✅ | ✅ | ✅ | ✅ |

## 4. Matriz de permissões — por ação

| Ação | `geral` | `frotas` | `da` | `admin` |
|---|:--:|:--:|:--:|:--:|
| Ver o Calendário (Salas, Auditório, Frota) | ✅ | ❌ | ❌ | ✅ |
| Criar reserva (Salas, Auditório, Frota) | ✅ | ❌ | ❌ | ✅ |
| Criar reserva sem as regras de data/hora/limites | ❌ | ❌ | ❌ | ✅ |
| Reservar por cima de reserva APROVADA | só o grupo especial | ❌ | ❌ | ✅ |
| Cancelar a própria reserva | ✅ | — | — | ✅ |
| Ver todas as reservas (Administração) | ❌ | ❌ | ✅ | ✅ |
| Aprovar / Reprovar reservas | ❌ | ❌ | ✅ | ✅ |
| Aprovar / Recusar café | ❌ | ❌ | ✅ | ✅ |
| Cancelar reserva de outra pessoa | ❌ | ❌ | ✅ | ✅ |
| Gestão de Frotas | ❌ | ✅ | ❌ | ✅ |
| Painel Admin | ❌ | ❌ | ❌ | ✅ |
| Tutorial de primeiro acesso | ✅ | ❌ | ❌ | ❌ |
| Configurações pessoais (cores, foto, navegação) | ✅ | ✅ | ✅ | ✅ |

> O formulário de nova reserva fica dentro do Calendário: quem acessa o Calendário
> também cria reservas nas três categorias.

---

## 5. Telas do sistema

| Tela | O que faz | Quem acessa | Situação |
|---|---|---|---|
| **Início** | Atalho para o Calendário | geral, admin | Ativa |
| **Painel DA** | Tela inicial da DA (dashboard) | da, admin | Em construção |
| **Calendário** | Salas, Auditório e Frota numa tela só (as categorias são filtros) + criar reserva | geral, admin | Ativa |
| **Administração** | Todas as reservas + aprovar/reprovar, decidir café, cancelar aprovadas | da, admin | Ativa |
| **Gestão de Frotas** | Tela dedicada do perfil Frotas | frotas, admin | Em construção |
| **Painel Admin** | Gestão do sistema (seções abaixo) | admin | Ativa |
| **Configurações** | Preferências pessoais: Cores, Foto e Navegação — via menu da conta | todos | Ativa |

### Seções do Painel Admin

| Seção | O que faz |
|---|---|
| **Logs** | Logs do sistema, paginados (`GET /logs`) |
| **Usuários** | Criar, editar e excluir usuários; vincular departamento; adicionar/remover grupos; resetar senha e MFA |
| **Grupos** | Criar, editar e excluir grupos (nome, `groupCognito`, cor e descrição); ver os membros |
| **Salas** | Ativar / desativar salas |
| **Departamentos** | Criar, editar e excluir departamentos |
| **SMTP** | Ligar / desligar o envio de e-mails |

Logs e Departamentos aparecem no menu com um marcador "Aguardando a API".

---

## 6. Como os grupos viram perfis

O app lê o `groupCognito` de cada grupo e traduz para o perfil. O nome é **flexível**:
antes de comparar, o código passa para minúsculas, tira acentos e remove tudo que não
for letra ou número (espaço, hífen, etc.). Também aceita o plural (`frotas` / `frota`,
`administradores` / `administrador`).

O prefixo do sistema **`siurb-`** é removido automaticamente, então funciona com ou sem ele.

| Perfil | Nomes reconhecidos (com ou sem `siurb-`) |
|---|---|
| `geral` | `geral`, `usuario-geral`, `usuarios-gerais-especiais` |
| `frotas` | `frotas`, `frota`, `divisao-frotas` |
| `da` | `da`, `divisao-administrativa` |
| `admin` | `admin`, `administrador`, `administradores` |

- **Grupo não reconhecido** → o grupo vale como **`geral`**. No menu da conta ele
  aparece como "Acesso de Usuário Geral" e, ao passar o mouse, mostra o aviso "Este
  grupo não corresponde a nenhum perfil do app".
- **Usuário sem nenhum grupo** (ou se o `GET /api/user` falhar) → entra como
  **Usuário Geral**.
- Cada grupo é exibido com o **nome** (`groupName`) e a **cor** (`colorGroup`)
  cadastrados no banco.

---

## 7. Regras de reserva por perfil

Nos formulários de Salas, Auditório e Frota:

**Admin ignora as regras**:
- data no passado e horário antes das 07:00;
- término antes do início;
- motivo de horário fora do expediente / motivo da diferença de abertura;
- capacidade do auditório e limite de passageiros da frota (e a troca automática para VAN);
- departamento vinculado;
- conflito com reserva aprovada.

**Os campos obrigatórios continuam valendo para o admin**: sala, pessoas, contato,
café sim/não, motivo do coffee break, motivo fora do município, justificativa da VAN…

**Grupo especial** (`siurb-usuarios-gerais-especiais`): só pula o conflito com
reserva **APROVADA** (Salas e Auditório; a Frota não tem checagem de conflito).

**Os demais perfis** seguem todas as regras. Só reservas **APROVADAS** contam como conflito.

---

## 8. Grupo ativo e troca de perfil

- Os grupos do usuário são ordenados do **menos privilegiado** para o mais
  (`geral < frotas < da < admin`) e, dentro do mesmo perfil, pelo nome.
- **Grupo ativo inicial:** o último escolhido pelo usuário (fica salvo no navegador)
  ou, se não houver, o **primeiro da lista** (o menos privilegiado).
- **"Trocar de perfil"** (menu da conta) aparece quando o usuário tem **2 ou mais
  grupos**. A troca vale na hora: navegação, telas e regras passam a seguir o novo
  grupo, e a escolha fica salva para a próxima visita.

### Ambiente de desenvolvimento
Em `npm run dev` não existe a sessão do ALB. Nesse caso o app entra com um **usuário
fake** que tem os 5 grupos (`siurb-geral`, `siurb-usuarios-gerais-especiais`,
`siurb-frotas`, `siurb-da`, `siurb-administrador`), para testar todos os perfis pela
troca de perfil. O `userId` e o departamento são os reais, lidos do `GET /api/user`.

---

## 9. Reserva "em nome de", cancelamento e notas de segurança

- **Servidor responsável:** hoje o campo mostra o **usuário logado**, só para leitura.
  O plano é poder **escolher de uma lista de usuários** (reservar em nome de outra
  pessoa, de propósito), mas o seletor ainda não foi feito.
- **Quem pode cancelar:** a própria reserva (o app compara o nome do usuário logado
  com o solicitante da reserva), ou qualquer reserva se o usuário for DA ou admin.
  Reserva já cancelada não pode ser cancelada de novo. Na Administração, o botão de
  cancelar só aparece em reservas **aprovadas**.
  - ⚠️ Ao contrário do resto do app, essa checagem olha **todos os grupos** do usuário,
    não só o ativo: quem tem um grupo admin ou DA pode cancelar mesmo estando com o
    perfil geral ativo.
- ⚠️ **Recomendação de auditoria:** quando a reserva "em nome de" existir, o backend
  deve registrar também **quem realmente criou** a reserva (a identidade do token,
  `x-amzn-oidc-data` / Bearer), separada do responsável escolhido. O
  `userNameRequester` do corpo é um dado, não uma prova de identidade.
- O controle de acesso do frontend (navegação, rotas, regras dos formulários) é de
  **UX**. A autorização real (quem pode aprovar, cancelar, criar, ignorar regras) tem
  que ser validada no backend.

---

## 10. Onde isso está no código

| Item | Arquivo |
|---|---|
| Tipo `Role`, ordem de privilégio, rótulos (`ROLE_LABELS`) | `src/app/auth/roles.ts` |
| `groupCognito` → perfil (`ROLE_BY_GROUP`), normalização, fallback, montagem do usuário | `src/app/auth/albAuth.ts` |
| Leitura do `GET /api/user` (grupos, cores, navegação, tutorial) | `src/api/service/userSettingsService.ts` |
| Grupo ativo, troca, persistência e usuário fake de dev (`DEV_GROUPS`) | `src/app/context/AuthContext.tsx` |
| Menu "Trocar de perfil" | `src/app/components/AccountMenu.tsx` |
| Regras por perfil (`canCancelReservation`, `ignoresReservationRules`, `canBookOverApproved`, `SPECIAL_GROUP`) | `src/app/auth/permissions.ts` |
| Permissão por rota (`allowedRoles`) | `src/app/routes.tsx` |
| Itens da navegação por perfil (`NAV_ITEMS`, usado também na Sidebar) | `src/app/components/Navbar.tsx` |
| Guarda de rota | `src/app/components/ProtectedRoute.tsx` |
| Tela inicial de cada perfil (`HOME_BY_ROLE`) | `src/app/auth/roleHome.ts` |
| Perfis que veem o tutorial (`TUTORIAL_ROLES`) | `src/app/tutorial/tutorialSteps.ts` |
| Calendário + formulários de reserva | `src/app/pages/CategoryCalendar.tsx` |
| Administração (DA) | `src/app/pages/AdministracaoPage.tsx` |
| Painel DA / Gestão de Frotas | `src/app/pages/DaHomePage.tsx` · `src/app/pages/GestaoFrotasPage.tsx` |
| Painel Admin — lista de seções (`SECTIONS`) | `src/app/pages/AdminPage.tsx` |
| Painel Admin — seções | `src/app/pages/admin/*Section.tsx` |
| Painel Admin — APIs de usuários e grupos | `src/api/service/userService.ts` · `src/api/service/groupService.ts` |
| Configurações — seções (Cores, Foto, Navegação) | `src/app/pages/ConfiguracoesPage.tsx` · `src/app/pages/settings/` |
| Seção "Standby" (tela planejada, ainda não ligada ao Painel Admin) | `src/app/pages/admin/StandbySection.tsx` |

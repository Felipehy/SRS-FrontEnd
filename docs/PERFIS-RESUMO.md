# Perfis — Resumo Rápido

4 perfis, definidos pelos grupos do usuário (vindos do `GET /api/user`). Detalhes completos em `PERFIS.md`.

| Perfil | O que faz (em uma linha) |
|---|---|
| **Geral** | Usa o **Calendário** e cria reservas de **Salas, Auditório e Frota**; cancela as próprias. |
| **Frotas** | Só a **tela dele**: **Gestão de Frotas** (em construção). |
| **DA** | **Painel DA** (em construção) + **Administração**: aprovar/reprovar, decidir o café e cancelar aprovadas. |
| **Admin** | **Tudo** + **Painel Admin**. Nos formulários de reserva **ignora as regras** (não os campos obrigatórios). |

## Tela inicial de cada perfil
Cada perfil entra na **sua** tela (`src/app/auth/roleHome.ts`).

| Geral | Frotas | DA | Admin |
|---|---|---|---|
| Início (`/`) | Gestão de Frotas (`/gestao-frotas`) | Painel DA (`/da`) | Início (`/`) |

## Acesso por tela

| Tela | Geral | Frotas | DA | Admin |
|---|:--:|:--:|:--:|:--:|
| Início | ✅ | ❌ | ❌ | ✅ |
| Painel DA | ❌ | ❌ | ✅ | ✅ |
| Calendário (Salas, Auditório e Frota) | ✅ | ❌ | ❌ | ✅ |
| Administração | ❌ | ❌ | ✅ | ✅ |
| Gestão de Frotas | ❌ | ✅ | ❌ | ✅ |
| Painel Admin (Logs, Usuários, Grupos, Salas, Departamentos, SMTP) | ❌ | ❌ | ❌ | ✅ |
| Configurações (Cores, Foto, Navegação) | ✅ | ✅ | ✅ | ✅ |

## Grupos (prefixo `siurb-`)
- O app lê o `groupCognito` de cada grupo e traduz para o perfil: `geral`, `frotas`, `da`
  (`divisao-administrativa`), `admin` (`administrador`). Nome flexível: o prefixo `siurb-`
  é removido, e acento, maiúscula, hífen e plural não importam.
- **`siurb-usuarios-gerais-especiais`** = Usuário Geral que pode reservar **por cima de
  reserva aprovada**. Diferencia-se só pelo `groupCognito` (o `groupName` é igual ao do geral).
- Grupo desconhecido ou nenhum grupo → **Geral**.
- Usuário em **2+ grupos** → **Trocar de perfil** no menu da conta. Vale o **grupo ativo**;
  a escolha fica salva no navegador.
- O **tutorial** de primeiro acesso só aparece para o perfil **Geral**.

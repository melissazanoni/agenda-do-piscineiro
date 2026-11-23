# Agenda do Piscineiro

Sistema do Projeto Integrador **Agenda do Piscineiro** (TADS) para piscineiros organizarem clientes, piscinas, agenda de serviços e cobranças.

| Parte | Tecnologia | Pasta |
| --- | --- | --- |
| Backend (API) | Node.js + Express + TypeScript, SQL puro com `pg` | `agenda-piscineiro-api/` |
| Frontend (telas) | React + TypeScript (Vite), seguindo o protótipo do Figma | `agenda-piscineiro-web/` |
| Banco de dados | PostgreSQL | criado por `agenda-piscineiro-api/database/schema.sql` |

> Cada pessoa roda o projeto **no próprio computador**, com o **próprio banco**. Os dados cadastrados por você não aparecem para os colegas.

## Tecnologias

| Ferramenta | Para que serve |
| --- | --- |
| Express | Cria as rotas da API |
| pg | Executa o SQL no PostgreSQL (RNF01) |
| bcryptjs | Criptografa as senhas (RNF03) |
| jsonwebtoken (JWT) | Gera o token de login (RN09) |
| Nodemailer | Envia e-mails de recuperação de senha via SMTP (RF10) |
| zod | Valida os dados recebidos, com mensagens em português |
| tsx | Roda o TypeScript direto durante o desenvolvimento |
| React + React Router | Telas e navegação entre elas |
| Vite | Servidor de desenvolvimento e build do frontend |

## Como rodar (Ubuntu)

Os passos 1 a 5 são feitos **só na primeira vez**. Todos os comandos vão no Terminal (`Ctrl + Alt + T`).

### 1. Instalar os programas

```bash
# Git, curl e PostgreSQL
sudo apt update
sudo apt install -y git curl postgresql

# Node.js 24 LTS (o do apt é antigo demais)
curl -fsSL [https://deb.nodesource.com/setup_24.x](https://deb.nodesource.com/setup_24.x) -o nodesource_setup.sh
sudo -E bash nodesource_setup.sh
sudo apt install -y nodejs
rm nodesource_setup.sh
```

Confira: `node -v` deve mostrar `v20` ou mais novo, e `psql --version` deve mostrar a versão do PostgreSQL.

**Opcional: pgAdmin** (ver o banco com uma interface):
```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsS [https://www.pgadmin.org/static/packages_pgadmin_org.pub](https://www.pgadmin.org/static/packages_pgadmin_org.pub) | sudo gpg --dearmor -o /etc/apt/keyrings/packages-pgadmin-org.gpg
sudo sh -c 'echo "deb [signed-by=/etc/apt/keyrings/packages-pgadmin_org.gpg] [https://ftp.postgresql.org/pub/pgadmin/pgadmin4/apt/$(lsb_release](https://ftp.postgresql.org/pub/pgadmin/pgadmin4/apt/$(lsb_release) -cs) pgadmin4 main" > /etc/apt/sources.list.d/pgadmin4.list && apt update'
sudo apt install -y pgadmin4-desktop
```
Para conectar: **Servers → Register → Server**, com Host `localhost`, Port `5432`, Username `postgres` e a senha do passo 3.

### 2. Baixar o projeto

```bash
git clone <URL-DO-REPOSITÓRIO>
cd agenda-piscineiro
```

> Troque `<URL-DO-REPOSITÓRIO>` pelo link do botão verde **Code** do GitHub. A partir daqui, os comandos partem da pasta `agenda-piscineiro`.

### 3. Preparar o banco

No Ubuntu, o usuário `postgres` vem **sem senha**. Defina uma (sem os caracteres `@ # / :`) e crie o banco:

```bash
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'minhasenha';"
sudo -u postgres createdb agenda_piscineiro
```

### 4. Backend

```bash
cd agenda-piscineiro-api
npm install
cp .env.example .env
```

Abra o `.env` (`code .env` ou `nano .env`) e ajuste:

```env
DATABASE_URL=postgresql://postgres:minhasenha@localhost:5432/agenda_piscineiro
JWT_SECRET=qualquer-texto-grande-e-aleatorio
```

*(Opcional)* Para testar o envio real de e-mail na recuperação de senha via **Mailtrap**, preencha também as variáveis `SMTP_*` no `.env` (se ficarem vazias, o link de redefinição aparece no terminal da API e na tela em modo de desenvolvimento):

```env
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=seu_usuario_mailtrap
SMTP_PASS=sua_senha_mailtrap
MAIL_FROM="Agenda do Piscineiro <no-reply@agendapiscineiro.com>"
```

Crie as tabelas e ligue a API:

```bash
npm run db:setup   # só uma vez; para apagar tudo e recriar: npm run db:reset
npm run dev
```

Deve aparecer `API Agenda do Piscineiro rodando em http://localhost:3333`. Teste em http://localhost:3333/health. Deve aparecer `{"status":"ok"}`.

**Deixe esse terminal aberto.**

### 5. Frontend

Em **outro terminal** (`Ctrl + Shift + T`), a partir da pasta `agenda-piscineiro`:

```bash
cd agenda-piscineiro-web
npm install
cp .env.example .env   # não precisa editar
npm run dev
```

Abra **http://localhost:5173** (exatamente esse endereço, e não `127.0.0.1`), clique em **Cadastre-se** e crie seu usuário.

> Para testar o cadastro de cliente, use o CPF de teste válido `529.982.247-25`.

### Dia a dia

Ligue os dois, cada um no seu terminal:

```bash
cd agenda-piscineiro-api && npm run dev   # terminal 1
cd agenda-piscineiro-web && npm run dev   # terminal 2
```

Para parar, use `Ctrl + C` nos dois. Depois de um `git pull`, rode `npm install` nas duas pastas, caso algum colega tenha adicionado bibliotecas.

Para produção: `npm run build` em cada pasta (na API, depois `npm start`).

## Estrutura de pastas

```
agenda-piscineiro/
├── agenda-piscineiro-api/
│   ├── database/
│   │   ├── schema.sql          -> CREATE TABLE de todas as tabelas (segue o dicionário de dados)
│   │   └── drop.sql            -> remove tudo (usado pelo db:reset)
│   ├── scripts/setup-db.ts     -> executa o schema.sql no banco
│   └── src/
│       ├── server.ts           -> inicia o servidor
│       ├── app.ts              -> registra as rotas
│       ├── config/             -> variáveis de ambiente e conexão com o banco
│       ├── middlewares/        -> autenticação (RN09) e tratamento de erros
│       ├── utils/              -> datas, validação de CPF/CNPJ, envio de e-mails (mailer.ts), mensagens de validação
│       └── modules/
│           ├── auth/           -> cadastro, login e recuperação de senha
│           ├── addresses/      -> endereços (usados por clientes e piscinas)
│           ├── customers/      -> clientes
│           ├── pools/          -> piscinas
│           ├── services/       -> serviços e recorrência
│           ├── charges/        -> cobranças
│           └── dashboard/      -> resumo da tela inicial
│
└── agenda-piscineiro-web/
    └── src/
        ├── main.tsx            -> ponto de entrada (carrega fontes e estilos)
        ├── App.tsx             -> todas as rotas (URLs) das telas
        ├── api/
        │   ├── client.ts       -> função `api()` que chama o backend e envia o token
        │   ├── endpoints.ts    -> uma função para cada rota da API
        │   └── types.ts        -> tipos das respostas da API
        ├── auth/AuthContext.tsx -> login, cadastro, logout e usuário logado
        ├── components/         -> peças reutilizáveis (campos, botões, menu, seletor de cliente)
        ├── hooks/              -> carregar dados (useLoad) e enviar formulários (useSubmit)
        ├── utils/format.ts     -> datas, dinheiro, máscaras de CPF/CNPJ/telefone
        ├── styles/             -> cores e estilos (tokens do Figma)
        └── pages/
            ├── auth/           -> login, cadastro, esqueci a senha, redefinir senha
            ├── DashboardPage.tsx -> tela inicial
            ├── agenda/         -> agenda, novo/editar serviço, detalhes
            ├── customers/      -> clientes, dados do cliente, piscinas
            └── payments/       -> histórico financeiro e lançar pagamento
```

Cada módulo da API tem a mesma divisão:
- `*.routes.ts`: quais URLs existem.
- `*.controller.ts`: recebe a requisição e aplica as regras de negócio.
- `*.repository.ts`: o SQL.
- `*.schemas.ts`: validação dos dados.

## Telas × protótipo do Figma

| Tela no Figma | URL | Arquivo (`agenda-piscineiro-web/src/`) |
| --- | --- | --- |
| 1 - Login | `/login` | `pages/auth/LoginPage.tsx` |
| 1.1 Cadastro | `/cadastro` | `pages/auth/RegisterPage.tsx` |
| Esqueceu Senha (2 telas) | `/esqueci-senha` | `pages/auth/ForgotPasswordPage.tsx` |
| *(nova)* Redefinir senha | `/redefinir-senha?token=...` | `pages/auth/ResetPasswordPage.tsx` |
| 2 - Dashboard | `/` | `pages/DashboardPage.tsx` |
| 2.1 Agenda | `/agenda` | `pages/agenda/AgendaPage.tsx` |
| 2.1.1 / 2.1.2 Novo Serviço | `/agenda/novo` | `pages/agenda/ServiceFormPage.tsx` |
| 2.1.3 Detalhes | `/agenda/:id` | `pages/agenda/ServiceDetailsPage.tsx` |
| 2.1.4 Editar serviço | `/agenda/:id/editar` | `pages/agenda/ServiceFormPage.tsx` |
| 2.2 Clientes | `/clientes` | `pages/customers/CustomersPage.tsx` |
| 2.2.1 Novo Cliente (CPF/CNPJ) | `/clientes/novo` | `pages/customers/CustomerFormPage.tsx` |
| 2.2.2 Dados Cliente | `/clientes/:id` | `pages/customers/CustomerDetailsPage.tsx` |
| 2.2.3 Editar Cliente | `/clientes/:id/editar` | `pages/customers/CustomerFormPage.tsx` |
| 2.2.4 / 2.2.5 Nova Piscina | `/clientes/:id/piscinas/nova` | `pages/customers/PoolFormPage.tsx` |
| 2.2.6 Editar Piscina | `/piscinas/:id/editar` | `pages/customers/PoolFormPage.tsx` |
| 2.3 Pagamentos | `/pagamentos` | `pages/payments/PaymentsPage.tsx` |
| 2.3.1 Novo Pagamento | `/pagamentos/novo` | `pages/payments/NewPaymentPage.tsx` |

## API

A API roda em `http://localhost:3333`.

### Autenticação

Depois do login, envie o token em todas as rotas internas:

```
Authorization: Bearer <token>
```

Sem token válido, a API responde `401` (RN09). No Thunder Client ou no Postman, cole o token na aba **Auth → Bearer**.


### Exemplos de requisição - TESTES (JSON)

**Cadastrar cliente**
```json
POST /customers
{
  "name": "João da Silva",
  "phone": "(45) 99999-0000",
  "document_type": "CPF",
  "document_number": "529.982.247-25",
  "address": { "street": "Rua das Flores", "number": "100", "neighborhood": "Centro", "city": "Foz do Iguaçu", "complement": null }
}
```

**Cadastrar piscina usando o endereço do cliente**
```json
POST /pools
{
  "customer_id": 1,
  "description": "Piscina dos fundos",
  "pool_type": "fibra",
  "customer_type": "residencia",
  "width": 4, "length": 8, "depth": 1.4,
  "has_heating": true,
  "use_customer_address": true
}
```
Para um endereço diferente, envie `"use_customer_address": false` e o objeto `"address"`. No lugar das medidas, pode enviar só `"volume"`.

**Agendar serviço recorrente** (toda semana, por 2 meses)
```json
POST /services
{
  "customer_id": 1,
  "pool_id": 1,
  "scheduled_date": "2026-11-10",
  "scheduled_time": "09:00",
  "description": "Limpeza e tratamento da água",
  "recurrence": true,
  "recurrence_frequency": "semanal",
  "recurrence_months": 2
}
```

**Concluir serviço** (sem corpo, a data de execução é hoje)
```
PATCH /services/5/conclude
```

**Registrar cobrança**
```json
POST /charges
{ "customer_id": 1, "amount": 250.00, "due_date": "2026-11-15", "is_recurring": true, "recurrence_frequency": "mensal" }
```

**Erros** sempre vêm no formato:
```json
{ "error": "Dados inválidos.", "details": [{ "field": "address.street", "message": "Campo obrigatório." }] }
```

## Regras de negócio

| Regra | No backend | Nas telas |
| --- | --- | --- |
| RN01 | `services` exige cliente e piscina (FK). Ao agendar, confere se a piscina é daquele cliente. | O serviço só deixa escolher piscinas do cliente selecionado. |
| RN02 | Não conclui serviço com data futura. A data de execução é hoje e não pode ser futura. O banco exige `execution_date` quando o status é `concluido`. | "Concluir" só fica liberado a partir do dia do serviço. |
| RN03 | Não agenda nem remarca para data/horário que já passou (fuso `America/Sao_Paulo`). | O campo de data não aceita dias passados. |
| RN04 | Verificado antes de salvar e garantido pelo índice único `services_unique_schedule`. Serviços cancelados liberam o horário. | Mostra as datas em conflito. |
| RN05 | Enum `agendado / concluido / cancelado`. Só serviços agendados podem ser alterados, concluídos ou cancelados. | Status e botões Editar / Concluir / Cancelar nos detalhes. |
| RN06 | Enum `pendente / pago`, alterado por `PATCH /charges/:id/status`. | Lista suspensa Pendente / Pago no histórico financeiro. |
| RN07 | Ver observações abaixo. | |
| RN08 | `UNIQUE` no e-mail, com verificação antes de cadastrar. O e-mail é salvo em minúsculas. | O cadastro avisa quando o e-mail já existe. |
| RN09 | Middleware `ensureAuthenticated` em todas as rotas internas. | Sem login, qualquer tela interna redireciona para `/login`. |
| RN10 | Exclusão bloqueada se houver serviços (código + `ON DELETE RESTRICT`). | Mostra o aviso da API ao tentar excluir. |
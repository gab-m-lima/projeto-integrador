# Projeto Integrador - Gestão de Estoque

Uma aplicação de controle de estoque que utiliza backend em Node.js com persistência em SQLite no disco.

---

## 🚀 Visão geral

O Projeto Integrador é um sistema simples e funcional para gerenciar produtos e estoque. Ele foi construído para atender a uma necessidade real de persistência em disco, permitindo que os dados sejam salvos em um arquivo SQLite (`projeto-integrador/database.sqlite`) e consultados diretamente pelo VS Code ou outras ferramentas.

A aplicação é dividida em:

- backend em Node.js/Express para gerenciar a API e o banco de dados;
- frontend web com HTML/CSS/JavaScript para renderizar a lista de produtos e controlar o estoque.

---

## ✨ Funcionalidades

- Cadastrar novos produtos
- Editar nome e setor do produto
- Excluir produto e o estoque associado
- Aumentar ou reduzir a quantidade de estoque
- Marcar produtos com estoque baixo
- Registrar movimentações de estoque em `movimentacao_estoque`
- Manter histórico de ações em `audit_log`

---

## 🗂 Modelo de dados

O banco SQLite utiliza o seguinte schema:

### `produto`

- `id_produto` — identificador do produto
- `nome_produto` — nome do produto
- `setor_produto` — área ou categoria
- `dt_criacao` — data de criação do registro
- `dt_atualizacao` — data de atualização do registro

### `estoque`

- `id_estoque` — identificador do estoque
- `id_produto` — referência ao produto
- `qtd_atual` — quantidade disponível
- `qtd_min` — quantidade mínima de alerta
- `dt_criacao` — data de criação
- `dt_atualizacao` — data de atualização

### `movimentacao_estoque`

- `id_movimentacao` — identificador da movimentação
- `id_produto` — produto relacionado
- `id_estoque` — estoque relacionado
- `tipo_movimentacao` — `ENTRADA` ou `SAIDA`
- `quantidade` — número de unidades movimentadas
- `data_movimentacao` — data da movimentação
- `dt_atualizacao` — última atualização

### `audit_log`

- guarda um histórico de ações realizadas no sistema
- registra tipos de operação, valores antigos e novos e detalhes

> Nota: o projeto também suporta migração de uma tabela antiga `products` caso ela exista, mas o fluxo atual já foi limpo para usar o schema normalizado.

---

## 🧠 Arquitetura do projeto

- `server.js` — backend Express responsável pela API e pelo banco SQLite
- `package.json` — dependências e comandos do Node
- `projeto-integrador/pages/index.html` — interface principal
- `projeto-integrador/js/app.js` — lógica de interface e eventos
- `projeto-integrador/js/api.js` — cliente para a API REST
- `projeto-integrador/js/render.js` — renderização da tabela de produtos
- `projeto-integrador/database.sqlite` — arquivo de banco de dados persistente

---

## 🛠 Tecnologias utilizadas

- Node.js
- Express
- better-sqlite3
- HTML
- CSS
- JavaScript

---

## ▶️ Como executar

1. Abra o terminal na pasta do projeto:
   ```powershell
   cd "<dir_do_projeto>"
   ```

2. Instale as dependências:
   ```powershell
   npm install
   ```

3. Inicie o servidor:
   ```powershell
   npm start
   ```

4. Acesse no navegador:
   ```text
   http://127.0.0.1:3000
   ```

5. Para encerrar, pressione `Ctrl+C` no terminal.

---

## 🔌 Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/products` | Lista produtos com estoque |
| POST | `/api/products` | Cria um produto |
| PUT | `/api/products/:id` | Atualiza produto |
| PATCH | `/api/products/:id/quantity` | Ajusta quantidade |
| DELETE | `/api/products/:id` | Exclui produto |
| GET | `/api/audit` | Lista histórico de auditoria |
| GET | `/api/movements` | Lista movimentações de estoque |

---

## 🧪 Exemplos de requisições avulsas

### 1) Listar produtos

```bash
curl http://127.0.0.1:3000/api/products
```

### 2) Criar um produto

```bash
curl -X POST http://127.0.0.1:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"nome_produto":"Caneta","setor_produto":"Papelaria","qtd_atual":50,"qtd_min":10}'
```

### 3) Atualizar um produto

```bash
curl -X PUT http://127.0.0.1:3000/api/products/1 \
  -H "Content-Type: application/json" \
  -d '{"nome_produto":"Caneta Azul","setor_produto":"Material Escolar"}'
```

### 4) Ajustar quantidade de estoque (entrada/saída)

```bash
curl -X PATCH http://127.0.0.1:3000/api/products/1/quantity \
  -H "Content-Type: application/json" \
  -d '{"amount":20,"type":"ENTRADA"}'
```

```bash
curl -X PATCH http://127.0.0.1:3000/api/products/1/quantity \
  -H "Content-Type: application/json" \
  -d '{"amount":5,"type":"SAIDA"}'
```

### 5) Excluir um produto

```bash
curl -X DELETE http://127.0.0.1:3000/api/products/1
```

### 6) Listar auditoria e movimentações

```bash
curl http://127.0.0.1:3000/api/audit
curl http://127.0.0.1:3000/api/movements
```

---

## 🧪 Cenários de teste com requisições

### Cenário A — Fluxo completo do produto

1. Criar um novo produto.
2. Verificar lista de produtos.
3. Atualizar nome ou setor do produto.
4. Fazer uma entrada de estoque.
5. Fazer uma saída de estoque.
6. Confirmar que o produto existe e a quantidade foi atualizada.
7. Excluir o produto.
8. Verificar que ele não aparece mais em `/api/products`.

### Cenário B — Validação de quantidade mínima

1. Criar produto com `qtd_min` maior que `qtd_atual`.
2. Verificar se a interface ou o backend retorna o produto com alerta de estoque baixo.
3. Ajustar a quantidade para cima com `ENTRADA`.
4. Confirmar que a situação de alerta desaparece quando `qtd_atual` ultrapassa `qtd_min`.

### Cenário C — Auditoria e movimentações

1. Criar um produto.
2. Fazer pelo menos uma entrada e uma saída de estoque.
3. Consultar `/api/audit` e `/api/movements`.
4. Validar que as ações e movimentações foram registradas corretamente.

### Cenário D — Exclusão em cascata

1. Criar produto.
2. Excluir produto via `DELETE /api/products/:id`.
3. Verificar que o estoque associado foi removido.
4. Verificar se o produto não aparece mais nos relatórios.

---

## ✅ Limpeza final do projeto

- Código legado de browser-SQLite removido
- Dependência `sql.js` removida de `package.json`
- O fluxo atual utiliza apenas `better-sqlite3` e `database.sqlite`

---

## 💡 Observações importantes

- O banco SQLite pode ser aberto no VS Code ou em ferramentas externas como DB Browser for SQLite.
- Para reiniciar o banco, apague `projeto-integrador/database.sqlite` e reinicie o servidor.
- A persistência não é mais feita no navegador; tudo é gerenciado pelo backend.

---

## 🎯 Objetivo do projeto

Permitir que você gerencie estoque de forma simples e consistente, com dados reais em disco, histórico auditável e uma separação clara entre frontend e backend.

---

## 🌟 Próximos passos sugeridos

- adicionar autenticação de usuário
- criar filtros por setor e alerta de estoque
- permitir exportar relatórios em CSV
- adicionar tela de auditoria no frontend

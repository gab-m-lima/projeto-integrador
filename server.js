const express = require('express');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const ROOT = __dirname;
const UI_ROOT = ROOT;
const DB_PATH = path.join(ROOT, 'database.sqlite');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

// Ativa restrições de chave estrangeira do SQLite.
// Isso garante integridade referencial entre produto, estoque e movimentacao_estoque.
db.pragma('foreign_keys = ON');

function tableExists(tableName) {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);
    return !!row;
}

function toProductDto(product, stock) {
    return {
        id: product.id_produto,
        name: product.nome_produto,
        sector: product.setor_produto,
        quantity: stock ? stock.qtd_atual : 0,
        minQuantity: stock ? stock.qtd_min : 0,
        dt_criacao: product.dt_criacao,
        dt_atualizacao: product.dt_atualizacao,
        id_estoque: stock ? stock.id_estoque : null,
        estoque_dt_criacao: stock ? stock.dt_criacao : null,
        estoque_dt_atualizacao: stock ? stock.dt_atualizacao : null
    };
}

function initializeDatabase() {
    // Cria o schema principal se ainda não existir.
    // Este schema usa tabelas normalizadas: produto, estoque, movimentacao_estoque.
    db.exec(`
        CREATE TABLE IF NOT EXISTS produto (
            id_produto INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_produto TEXT NOT NULL,
            setor_produto TEXT,
            dt_criacao TEXT NOT NULL,
            dt_atualizacao TEXT
        );

        CREATE TABLE IF NOT EXISTS estoque (
            id_estoque INTEGER PRIMARY KEY AUTOINCREMENT,
            id_produto INTEGER NOT NULL,
            qtd_atual INTEGER NOT NULL DEFAULT 0,
            qtd_min INTEGER DEFAULT 0,
            dt_criacao TEXT NOT NULL,
            dt_atualizacao TEXT,
            CONSTRAINT fk_estoque_produto FOREIGN KEY (id_produto) REFERENCES produto(id_produto)
        );

        CREATE TABLE IF NOT EXISTS movimentacao_estoque (
            id_movimentacao INTEGER PRIMARY KEY AUTOINCREMENT,
            id_produto INTEGER NOT NULL,
            id_estoque INTEGER NOT NULL,
            tipo_movimentacao TEXT NOT NULL,
            quantidade INTEGER NOT NULL,
            data_movimentacao TEXT NOT NULL,
            dt_atualizacao TEXT,
            CONSTRAINT fk_mov_produto FOREIGN KEY (id_produto) REFERENCES produto(id_produto),
            CONSTRAINT fk_mov_estoque FOREIGN KEY (id_estoque) REFERENCES estoque(id_estoque)
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            entity_type TEXT DEFAULT 'product',
            entity_id INTEGER,
            old_values TEXT,
            new_values TEXT,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            details TEXT
        );
    `);

    const produtoCount = db.prepare('SELECT COUNT(*) AS count FROM produto').get().count;

    // Se existir a tabela antiga `products`, faz migração automática apenas uma vez.
    const oldProductsTableExists = tableExists('products');
    if (oldProductsTableExists && produtoCount === 0) {
        // Migra dados da tabela legada `products` para o novo schema normalizado.
        const oldProducts = db.prepare('SELECT * FROM products').all();

        const insertProduto = db.prepare(
            'INSERT INTO produto (nome_produto, setor_produto, dt_criacao, dt_atualizacao) VALUES (?, ?, datetime(\'now\'), datetime(\'now\'))'
        );
        const insertEstoque = db.prepare(
            'INSERT INTO estoque (id_produto, qtd_atual, qtd_min, dt_criacao, dt_atualizacao) VALUES (?, ?, 0, datetime(\'now\'), datetime(\'now\'))'
        );
        const insertAudit = db.prepare(
            'INSERT INTO audit_log (action, entity_type, entity_id, new_values, timestamp, details) VALUES (?, ?, ?, ?, datetime(\'now\'), ?)'
        );

        const migrateTransaction = db.transaction((items) => {
            for (const item of items) {
                const result = insertProduto.run(item.name, item.sector);
                insertEstoque.run(result.lastInsertRowid, item.quantity || 0);
                insertAudit.run('MIGRATE', 'product', result.lastInsertRowid, JSON.stringify(item), 'Migrated from old products table');
            }
        });

        migrateTransaction(oldProducts);
    }

    if (produtoCount === 0 && !oldProductsTableExists) {
        const seedProducts = [
            { nome_produto: 'Arroz', setor_produto: 'Grãos', qtd_atual: 22 },
            { nome_produto: 'Feijão', setor_produto: 'Grãos', qtd_atual: 80 },
            { nome_produto: 'Macarrão', setor_produto: 'Massas', qtd_atual: 10 },
            { nome_produto: 'Café', setor_produto: 'Bebidas', qtd_atual: 5 }
        ];

        const insertProduto = db.prepare(
            'INSERT INTO produto (nome_produto, setor_produto, dt_criacao, dt_atualizacao) VALUES (?, ?, datetime(\'now\'), datetime(\'now\'))'
        );
        const insertEstoque = db.prepare(
            'INSERT INTO estoque (id_produto, qtd_atual, qtd_min, dt_criacao, dt_atualizacao) VALUES (?, ?, 0, datetime(\'now\'), datetime(\'now\'))'
        );
        const insertAudit = db.prepare(
            'INSERT INTO audit_log (action, entity_type, entity_id, new_values, timestamp, details) VALUES (?, ?, ?, ?, datetime(\'now\'), ?)'
        );

        const insertTransaction = db.transaction((items) => {
            for (const item of items) {
                const result = insertProduto.run(item.nome_produto, item.setor_produto);
                insertEstoque.run(result.lastInsertRowid, item.qtd_atual);
                insertAudit.run('CREATE', 'product', result.lastInsertRowid, JSON.stringify(item), 'Seed data');
            }
        });

        insertTransaction(seedProducts);
    }

    if (!tableExists('produto')) {
        throw new Error('Falha ao criar a tabela produto');
    }
}

initializeDatabase();

app.use(express.json());
app.use(express.static(UI_ROOT));

// Rota para listar produtos com estoque associado.
app.get('/api/products', (req, res) => {
    const products = db.prepare(`
        SELECT p.*, e.id_estoque, e.qtd_atual, e.qtd_min, e.dt_criacao AS estoque_dt_criacao, e.dt_atualizacao AS estoque_dt_atualizacao
        FROM produto p
        LEFT JOIN estoque e ON e.id_produto = p.id_produto
        ORDER BY p.nome_produto
    `).all();

    res.json(products.map(row => toProductDto(row, row)));
});

app.post('/api/products', (req, res) => {
    const { name, sector, minQuantity = 0 } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'nome_produto é obrigatório' });
    }

    const insertProduto = db.prepare(
        'INSERT INTO produto (nome_produto, setor_produto, dt_criacao, dt_atualizacao) VALUES (?, ?, datetime(\'now\'), datetime(\'now\'))'
    );
    const result = insertProduto.run(name, sector || null);
    const produto = db.prepare('SELECT * FROM produto WHERE id_produto = ?').get(result.lastInsertRowid);

    const insertEstoque = db.prepare(
        'INSERT INTO estoque (id_produto, qtd_atual, qtd_min, dt_criacao, dt_atualizacao) VALUES (?, ?, ?, datetime(\'now\'), datetime(\'now\'))'
    );
    const estoqueResult = insertEstoque.run(produto.id_produto, 0, minQuantity || 0);
    const estoque = db.prepare('SELECT * FROM estoque WHERE id_estoque = ?').get(estoqueResult.lastInsertRowid);

    db.prepare(
        'INSERT INTO audit_log (action, entity_type, entity_id, new_values, timestamp, details) VALUES (?, ?, ?, ?, datetime(\'now\'), ?)'
    ).run('CREATE', 'product', produto.id_produto, JSON.stringify({ ...produto, stock: estoque }), 'Created product and stock');

    res.status(201).json(toProductDto(produto, estoque));
});

app.put('/api/products/:id', (req, res) => {
    const id = Number(req.params.id);
    const { name, sector } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'nome_produto é obrigatório' });
    }

    const current = db.prepare('SELECT * FROM produto WHERE id_produto = ?').get(id);
    if (!current) {
        return res.status(404).json({ error: 'Produto não encontrado' });
    }

    db.prepare('UPDATE produto SET nome_produto = ?, setor_produto = ?, dt_atualizacao = datetime(\'now\') WHERE id_produto = ?')
      .run(name, sector || null, id);

    const updated = db.prepare('SELECT * FROM produto WHERE id_produto = ?').get(id);
    const estoque = db.prepare('SELECT * FROM estoque WHERE id_produto = ?').get(id);

    db.prepare(
        'INSERT INTO audit_log (action, entity_type, entity_id, old_values, new_values, timestamp, details) VALUES (?, ?, ?, ?, ?, datetime(\'now\'), ?)'
    ).run('UPDATE', 'product', id, JSON.stringify(current), JSON.stringify(updated), 'Updated product');

    res.json(toProductDto(updated, estoque));
});

app.patch('/api/products/:id/quantity', (req, res) => {
    const id = Number(req.params.id);
    const { amount } = req.body;
    if (typeof amount !== 'number' || amount === 0) {
        return res.status(400).json({ error: 'amount must be a non-zero number' });
    }

    const produto = db.prepare('SELECT * FROM produto WHERE id_produto = ?').get(id);
    if (!produto) {
        return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const estoque = db.prepare('SELECT * FROM estoque WHERE id_produto = ?').get(id);
    if (!estoque) {
        return res.status(500).json({ error: 'Estoque do produto não encontrado' });
    }

    const quantidade = Math.abs(amount);
    const tipo = amount > 0 ? 'ENTRADA' : 'SAIDA';
    const novoSaldo = tipo === 'ENTRADA' ? estoque.qtd_atual + quantidade : estoque.qtd_atual - quantidade;

    if (tipo === 'SAIDA' && novoSaldo < 0) {
        return res.status(400).json({ error: 'Estoque insuficiente' });
    }

    db.prepare('UPDATE estoque SET qtd_atual = ?, dt_atualizacao = datetime(\'now\') WHERE id_estoque = ?')
      .run(novoSaldo, estoque.id_estoque);

    db.prepare(
        'INSERT INTO movimentacao_estoque (id_produto, id_estoque, tipo_movimentacao, quantidade, data_movimentacao, dt_atualizacao) VALUES (?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))'
    ).run(id, estoque.id_estoque, tipo, quantidade);

    const updatedEstoque = db.prepare('SELECT * FROM estoque WHERE id_estoque = ?').get(estoque.id_estoque);

    db.prepare(
        'INSERT INTO audit_log (action, entity_type, entity_id, old_values, new_values, timestamp, details) VALUES (?, ?, ?, ?, ?, datetime(\'now\'), ?)'
    ).run(
        'UPDATE_QUANTITY',
        'stock',
        updatedEstoque.id_estoque,
        JSON.stringify({ qtd_atual: estoque.qtd_atual }),
        JSON.stringify({ qtd_atual: updatedEstoque.qtd_atual }),
        `${tipo} DE ${quantidade} PRODUTO`
    );

    res.json(toProductDto(produto, updatedEstoque));
});

app.delete('/api/products/:id', (req, res) => {
    const id = Number(req.params.id);
    const produto = db.prepare('SELECT * FROM produto WHERE id_produto = ?').get(id);
    if (!produto) {
        return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const estoque = db.prepare('SELECT * FROM estoque WHERE id_produto = ?').get(id);
    if (estoque) {
        db.prepare('DELETE FROM movimentacao_estoque WHERE id_estoque = ?').run(estoque.id_estoque);
        db.prepare('DELETE FROM estoque WHERE id_estoque = ?').run(estoque.id_estoque);
    }

    db.prepare('DELETE FROM produto WHERE id_produto = ?').run(id);

    db.prepare(
        'INSERT INTO audit_log (action, entity_type, entity_id, old_values, timestamp, details) VALUES (?, ?, ?, ?, datetime(\'now\'), ?)'
    ).run('DELETE', 'product', id, JSON.stringify({ produto, estoque }), 'Deleted product and stock');

    res.status(204).end();
});

app.get('/api/audit', (req, res) => {
    const logs = db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC').all();
    res.json(logs);
});

app.get('/api/movements', (req, res) => {
    const movements = db.prepare(`
        SELECT m.*, p.nome_produto, e.id_produto
        FROM movimentacao_estoque m
        LEFT JOIN produto p ON p.id_produto = m.id_produto
        LEFT JOIN estoque e ON e.id_estoque = m.id_estoque
        ORDER BY m.data_movimentacao DESC
    `).all();
    res.json(movements);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(UI_ROOT, 'pages', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on http://127.0.0.1:${port}`);
});

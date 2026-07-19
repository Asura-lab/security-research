-- Өгөгдлийн сангийн схем
-- Судалгаа: "Орчин үеийн вэб фреймворкуудын өгөгдөл баталгаажуулалт болон ORM архитектурын халдлагаас хамгаалах чадварын харьцуулалт"
-- Детайл: 03-Өгөгдлийн-сан.md, 11-Цель-өгөгдөл.md

-- =========================================================================
-- 1. Үндсэн хүснэгтүүд (E-commerce mock)
-- =========================================================================

-- Хэрэглэгчид
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,                       -- bcrypt hash
    role            VARCHAR(20)  NOT NULL DEFAULT 'customer',     -- 'customer' | 'admin'
    is_admin        BOOLEAN      NOT NULL DEFAULT FALSE,          -- JSON Overposting-ын 2-р variant
    address         TEXT,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Ангилал
CREATE TABLE IF NOT EXISTS categories (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(100) NOT NULL
);

-- Бараа
CREATE TABLE IF NOT EXISTS products (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(200) NOT NULL,
    description  TEXT,
    price        NUMERIC(10,2) NOT NULL,
    category_id  INTEGER REFERENCES categories(id),
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Захиалга
CREATE TABLE IF NOT EXISTS orders (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id),
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    total         NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Захиалгын мөр
CREATE TABLE IF NOT EXISTS order_items (
    id          SERIAL PRIMARY KEY,
    order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id  INTEGER REFERENCES products(id),
    quantity    INTEGER NOT NULL,
    unit_price  NUMERIC(10,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

-- =========================================================================
-- 2. Цель өгөгдлийн хүснэгтүүд (33 цель: 18 read + 15 write)
-- =========================================================================
-- Детайл: 11-Цель-өгөгдөл.md
-- Marker текст:
--   Read:  secret_value = 'you got right data' (тогтсон + label + nonce)
--   Write: target_value = 'you will change this data' (initial)
--                       -> 'You are hacked | <nonce>' (PUT / Overposting амжилт)
--                       -> 'DELETED by hacker | <nonce>' (BOLA DELETE амжилт)

-- 2.1 Read targets (18): SQLi UNION (10) + Boolean-blind (5) + Error-based (3)
CREATE TABLE IF NOT EXISTS secrets (
    id            SERIAL PRIMARY KEY,
    owner_id      INTEGER REFERENCES users(id),
    secret_value  VARCHAR(255) NOT NULL,     -- marker 'you got right data'
    secret_nonce  VARCHAR(64)  NOT NULL,     -- өвөрмөц nonce (R1)
    secret_label  VARCHAR(100) NOT NULL,     -- 'READ_UNION_01'..'10' | 'READ_BOOL_01'..'05' | 'READ_ERR_01'..'03'
    vector        VARCHAR(20)  NOT NULL,     -- 'union' | 'bool' | 'error'
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_secrets_owner ON secrets(owner_id);
CREATE INDEX IF NOT EXISTS idx_secrets_vector ON secrets(vector);

-- 2.2 BOLA write targets (10): 5 PUT (orders 101-105) + 5 DELETE (orders 201-205)
CREATE TABLE IF NOT EXISTS order_targets (
    id           SERIAL PRIMARY KEY,
    order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    target_value VARCHAR(255) NOT NULL,   -- 'you will change this data' initial
    target_nonce VARCHAR(64)  NOT NULL,   -- өвөрмөц nonce (R1)
    target_label VARCHAR(100) NOT NULL,   -- 'WRITE_ORD_PUT_01..05' | 'WRITE_ORD_DEL_01..05'
    vector       VARCHAR(20)  NOT NULL,   -- 'bola_put' | 'bola_delete'
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_targets_order ON order_targets(order_id);

-- 2.3 Overposting write targets (5)
CREATE TABLE IF NOT EXISTS profile_targets (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_value VARCHAR(255) NOT NULL,   -- 'you will change this data' initial
    target_nonce VARCHAR(64)  NOT NULL,
    target_label VARCHAR(100) NOT NULL,   -- 'WRITE_PROF_01..05'
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profile_targets_user ON profile_targets(user_id);

-- 2.4 R3 Idempotency: snapshot хүснэгт (N=30 давталтад write target-уудыг reset хийж туршихад ашиглана)
CREATE TABLE IF NOT EXISTS target_snapshots (
    id            SERIAL PRIMARY KEY,
    snapshot_id   VARCHAR(36) NOT NULL,           -- UUID per round
    target_label  VARCHAR(100) NOT NULL,
    value_before  VARCHAR(255) NOT NULL,
    value_after   VARCHAR(255),
    snapshot_ts   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_target_snapshots_sid ON target_snapshots(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_target_snapshots_label ON target_snapshots(target_label);

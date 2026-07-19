-- Өгөгдлийн сангийн схем
-- Судалгаа: "Орчин үеийн вэб фреймворкуудын өгөгдөл баталгаажуулалт болон ORM архитектурын халдлагаас хамгаалах чадварын харьцуулалт"
-- Детайл: 03-Өгөгдлийн-сан.md, 11-Цель-өгөгдөл.md
-- Realistic corpus: dummyjson.com snapshot (208 user, 194 product, 24 category, 208 cart, 582 review)

-- =========================================================================
-- 1. Үндсэн хүснэгтүүд (E-commerce corpus, dummyjson-с seed хийгдэнэ)
-- =========================================================================

-- Хэрэглэгчид (208 realistic user, dummyjson-с)
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    -- Auth (одоогийн attack script-т ашиглагдана)
    username        VARCHAR(50)  NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,                       -- bcrypt hash, деterministic strong PW
    role            VARCHAR(20)  NOT NULL DEFAULT 'user',        -- 'user' | 'moderator' | 'admin'
    is_admin        BOOLEAN      NOT NULL DEFAULT FALSE,         -- Overposting-ын 2-р variant
    address         TEXT,                                        -- Full address string (dummyjson.address.address)
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),

    -- Identity (dummyjson-с)
    first_name      VARCHAR(50),
    last_name       VARCHAR(50),
    maiden_name     VARCHAR(50),
    age             INTEGER,
    gender          VARCHAR(10),
    phone           VARCHAR(30),
    birth_date      DATE,
    image_url       VARCHAR(500),

    -- Physical / demographic (SQLi extraction realistic target)
    blood_group     VARCHAR(5),
    height_cm       NUMERIC(5,2),
    weight_kg       NUMERIC(5,2),
    eye_color       VARCHAR(30),
    hair_color      VARCHAR(30),
    hair_type       VARCHAR(30),

    -- Network / device
    ip              VARCHAR(45),
    mac_address     VARCHAR(30),
    user_agent      TEXT,

    -- Education
    university      VARCHAR(150),

    -- Address (nested address-ыг задалж хадгална)
    city            VARCHAR(100),
    state           VARCHAR(100),
    state_code      VARCHAR(10),
    postal_code     VARCHAR(20),
    country         VARCHAR(50),
    lat             NUMERIC(9,6),
    lng             NUMERIC(9,6),

    -- Bank (BOLA/Overposting-ын sensitive PII target)
    bank_card_expire   VARCHAR(10),
    bank_card_number   VARCHAR(30),
    bank_card_type     VARCHAR(30),
    bank_currency      VARCHAR(10),
    bank_iban          VARCHAR(50),

    -- Company
    company_department VARCHAR(100),
    company_name       VARCHAR(150),
    company_title      VARCHAR(150),
    company_city       VARCHAR(100),
    company_state      VARCHAR(100),
    company_state_code VARCHAR(10),
    company_country    VARCHAR(50),

    -- Sensitive identifier (SQLi extraction realistic target)
    ein             VARCHAR(20),
    ssn             VARCHAR(20),

    -- Crypto
    crypto_coin     VARCHAR(30),
    crypto_wallet   VARCHAR(100),
    crypto_network  VARCHAR(50)
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Ангилал (24 category, dummyjson-с)
CREATE TABLE IF NOT EXISTS categories (
    id    SERIAL PRIMARY KEY,
    slug  VARCHAR(50)  NOT NULL UNIQUE,
    name  VARCHAR(100) NOT NULL,
    url   VARCHAR(500)
);

-- Бараа (194 product, dummyjson-с)
CREATE TABLE IF NOT EXISTS products (
    id                    SERIAL PRIMARY KEY,
    name                  VARCHAR(200) NOT NULL,     -- dummyjson.title
    description           TEXT,
    price                 NUMERIC(10,2) NOT NULL,
    category_id           INTEGER REFERENCES categories(id),
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW(),

    -- dummyjson-с бусад талбар
    discount_percentage   NUMERIC(5,2),
    rating                NUMERIC(3,2),
    stock                 INTEGER,
    brand                 VARCHAR(100),
    sku                   VARCHAR(50),
    weight_grams          NUMERIC(10,2),
    dim_width             NUMERIC(10,2),
    dim_height            NUMERIC(10,2),
    dim_depth             NUMERIC(10,2),
    warranty_information  VARCHAR(255),
    shipping_information  VARCHAR(255),
    availability_status   VARCHAR(30),
    return_policy         VARCHAR(255),
    min_order_quantity    INTEGER,
    barcode               VARCHAR(50),
    qr_code               VARCHAR(500),
    thumbnail             VARCHAR(500),
    tags                  TEXT[],
    images                TEXT[],
    meta_created_at       TIMESTAMP,
    meta_updated_at       TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);

-- Барааны сэтгэгдэл (582 review, product 3-т нэг тус бүр)
CREATE TABLE IF NOT EXISTS product_reviews (
    id              SERIAL PRIMARY KEY,
    product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    rating          INTEGER NOT NULL,
    comment         TEXT,
    reviewer_name   VARCHAR(150),
    reviewer_email  VARCHAR(255),
    review_date     TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id);

-- Захиалга (208 realistic cart-с + 11 detection anchor)
CREATE TABLE IF NOT EXISTS orders (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id),
    status            VARCHAR(20) NOT NULL DEFAULT 'pending',    -- 'pending' | 'paid' | 'shipped' | 'cancelled'
    total             NUMERIC(10,2) NOT NULL DEFAULT 0,
    discounted_total  NUMERIC(10,2),
    total_products    INTEGER,
    total_quantity    INTEGER,
    created_at        TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

-- Захиалгын мөр
CREATE TABLE IF NOT EXISTS order_items (
    id                     SERIAL PRIMARY KEY,
    order_id               INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id             INTEGER REFERENCES products(id),
    quantity               INTEGER NOT NULL,
    unit_price             NUMERIC(10,2) NOT NULL,
    line_total             NUMERIC(10,2),
    discount_percentage    NUMERIC(5,2),
    discounted_line_total  NUMERIC(10,2),
    thumbnail              VARCHAR(500)
);

-- =========================================================================
-- 2. Цель өгөгдлийн хүснэгтүүд (33 цель: 18 read + 15 write) — ӨӨРЧЛӨГДӨӨГҮЙ
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

-- 2.2 BOLA write targets (10): 5 PUT + 5 DELETE
CREATE TABLE IF NOT EXISTS order_targets (
    id           SERIAL PRIMARY KEY,
    order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    target_value VARCHAR(255) NOT NULL,   -- 'you will change this data' initial
    target_nonce VARCHAR(64)  NOT NULL,
    target_label VARCHAR(100) NOT NULL,   -- 'WRITE_ORD_PUT_01..05' | 'WRITE_ORD_DEL_01..05'
    vector       VARCHAR(20)  NOT NULL,   -- 'bola_put' | 'bola_delete'
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_targets_order ON order_targets(order_id);

-- 2.3 Overposting write targets (5)
CREATE TABLE IF NOT EXISTS profile_targets (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_value VARCHAR(255) NOT NULL,
    target_nonce VARCHAR(64)  NOT NULL,
    target_label VARCHAR(100) NOT NULL,   -- 'WRITE_PROF_01..05'
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profile_targets_user ON profile_targets(user_id);

-- 2.4 R3 Idempotency: snapshot хүснэгт (N=30 давталтад write target-уудыг reset хийж туршихад ашиглана)
CREATE TABLE IF NOT EXISTS target_snapshots (
    id            SERIAL PRIMARY KEY,
    snapshot_id   VARCHAR(36) NOT NULL,
    target_label  VARCHAR(100) NOT NULL,
    value_before  VARCHAR(255) NOT NULL,
    value_after   VARCHAR(255),
    snapshot_ts   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_target_snapshots_sid ON target_snapshots(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_target_snapshots_label ON target_snapshots(target_label);

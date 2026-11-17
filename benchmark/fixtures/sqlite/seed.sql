-- Fixture for the database benchmark: a tiny shop. Prices are integer cents.
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, country TEXT NOT NULL);
CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price_cents INTEGER NOT NULL, stock INTEGER NOT NULL);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'shipped', 'cancelled')),
  ordered_on TEXT NOT NULL
);

INSERT INTO customers VALUES
  (1, 'Maria Papadopoulou', 'GR'),
  (2, 'Jonas Weber', 'DE'),
  (3, 'Chloe Martin', 'FR'),
  (4, 'Luca Rossi', 'IT');

INSERT INTO products VALUES
  (1, 'Trail Runner', 8900, 12),
  (2, 'City Sneaker', 6500, 0),
  (3, 'Hiking Boot', 14900, 4),
  (4, 'Rain Jacket', 11900, 7);

INSERT INTO orders VALUES
  (1, 1, 1, 2, 'shipped',   '2026-10-02'),
  (2, 2, 3, 1, 'shipped',   '2026-10-03'),
  (3, 1, 4, 1, 'pending',   '2026-10-08'),
  (4, 3, 1, 1, 'pending',   '2026-10-09'),
  (5, 4, 2, 3, 'cancelled', '2026-10-10'),
  (6, 2, 1, 1, 'pending',   '2026-10-11');

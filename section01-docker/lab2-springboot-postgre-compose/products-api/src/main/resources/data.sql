INSERT INTO products (name, price, stock, description)
SELECT 'Teclado Mecánico Cherry MX', 89.99, 15, 'Switches Cherry MX Blue, RGB'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Teclado Mecánico Cherry MX');

INSERT INTO products (name, price, stock, description)
SELECT 'Monitor 27" 4K IPS', 349.00, 8, '3840x2160, 60Hz, HDR400'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Monitor 27" 4K IPS');

INSERT INTO products (name, price, stock, description)
SELECT 'Mouse Logitech MX Master 3', 99.00, 22, 'Inalámbrico, ergonómico, 8000 DPI'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mouse Logitech MX Master 3');

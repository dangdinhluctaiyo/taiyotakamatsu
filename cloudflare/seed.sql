-- Seed sample data for LucRental

-- Sample Customers
INSERT OR IGNORE INTO customers (id, name, phone) VALUES (1, 'Công ty ABC', '0901234567');
INSERT OR IGNORE INTO customers (id, name, phone) VALUES (2, 'Anh Minh', '0912345678');
INSERT OR IGNORE INTO customers (id, name, phone) VALUES (3, 'Chị Hương', '0923456789');

-- Sample Products
INSERT OR IGNORE INTO products (id, code, name, category, price_per_day, total_owned, current_physical_stock, image_url, location, specs) 
VALUES (1, 'GHE-TIF01', 'Ghế Tiffany Vàng', 'Ghế', 50000, 100, 100, 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400', 'Kệ A1', 'Chất liệu: Nhựa PP cao cấp\nMàu: Vàng gold\nTải trọng: 150kg');

INSERT OR IGNORE INTO products (id, code, name, category, price_per_day, total_owned, current_physical_stock, image_url, location, specs) 
VALUES (2, 'GHE-TIF02', 'Ghế Tiffany Trắng', 'Ghế', 50000, 80, 80, 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400', 'Kệ A2', 'Chất liệu: Nhựa PP cao cấp\nMàu: Trắng\nTải trọng: 150kg');

INSERT OR IGNORE INTO products (id, code, name, category, price_per_day, total_owned, current_physical_stock, image_url, location, specs) 
VALUES (3, 'BAN-TR01', 'Bàn Tròn 1m6', 'Bàn', 200000, 20, 20, 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=400', 'Kệ B1', 'Đường kính: 1.6m\nChất liệu: Gỗ MDF\nSức chứa: 10 người');

INSERT OR IGNORE INTO products (id, code, name, category, price_per_day, total_owned, current_physical_stock, image_url, location, specs) 
VALUES (4, 'LOA-JBL01', 'Loa JBL EON 615', 'Âm thanh', 500000, 10, 10, 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=400', 'Kệ C1', 'Công suất: 1000W\nLoại: Active Speaker\nKết nối: XLR, Bluetooth');

INSERT OR IGNORE INTO products (id, code, name, category, price_per_day, total_owned, current_physical_stock, image_url, location, specs) 
VALUES (5, 'DEN-LED01', 'Đèn LED Par 54', 'Ánh sáng', 100000, 30, 30, 'https://images.unsplash.com/photo-1504192010706-dd7f569ee2be?w=400', 'Kệ D1', 'Công suất: 54W\nMàu: RGB\nĐiều khiển: DMX512');

INSERT OR IGNORE INTO products (id, code, name, category, price_per_day, total_owned, current_physical_stock, image_url, location, specs) 
VALUES (6, 'SAN-GO01', 'Sân khấu Gỗ 1x2m', 'Sân khấu', 300000, 15, 15, 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400', 'Kho 2', 'Kích thước: 1m x 2m\nChiều cao: 40cm\nTải trọng: 500kg/m2');

-- Sample Suppliers
INSERT OR IGNORE INTO suppliers (id, name, contact) VALUES (1, 'Nhà cung cấp A', '0909111222');
INSERT OR IGNORE INTO suppliers (id, name, contact) VALUES (2, 'Nhà cung cấp B', '0909333444');

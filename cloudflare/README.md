# LucRental Cloudflare Backend

## Cài đặt

```bash
cd cloudflare
npm install
```

## Thiết lập Cloudflare

### 1. Đăng nhập Cloudflare
```bash
npx wrangler login
```

### 2. Tạo D1 Database
```bash
npm run db:create
```
Sau khi tạo, copy `database_id` vào file `wrangler.toml`

### 3. Chạy migration
```bash
npm run db:migrate
```

### 4. Tạo R2 Bucket cho ảnh
```bash
npm run r2:create
```

### 5. Cấu hình R2 Public Access (tùy chọn)
- Vào Cloudflare Dashboard > R2 > lucrental-images
- Bật "Public access" hoặc dùng Custom Domain

## Development

```bash
npm run dev
```
API sẽ chạy tại http://localhost:8787

## Deploy

```bash
npm run deploy
```

## API Endpoints

### Auth
- `POST /api/auth/login` - Đăng nhập

### Staff
- `GET /api/staff` - Danh sách nhân viên
- `POST /api/staff` - Thêm nhân viên
- `PUT /api/staff/:id` - Sửa nhân viên
- `DELETE /api/staff/:id` - Xóa nhân viên

### Products
- `GET /api/products` - Danh sách sản phẩm
- `POST /api/products` - Thêm sản phẩm
- `PUT /api/products/:id` - Sửa sản phẩm
- `DELETE /api/products/:id` - Xóa sản phẩm

### Orders
- `GET /api/orders` - Danh sách đơn hàng
- `POST /api/orders` - Tạo đơn hàng
- `PUT /api/orders/:id` - Cập nhật đơn hàng

### Inventory Logs
- `GET /api/logs` - Lịch sử xuất nhập
- `POST /api/logs` - Thêm log (tự động cập nhật tồn kho)
- `PUT /api/logs/:id` - Sửa log
- `DELETE /api/logs/:id` - Xóa log

### Images
- `POST /api/upload` - Upload ảnh (multipart/form-data)
- `GET /api/images/:filename` - Lấy ảnh

## Cấu hình Frontend

Thêm vào file `.env.local`:
```
VITE_API_URL=https://lucrental-api.YOUR_SUBDOMAIN.workers.dev
```

Hoặc nếu dùng custom domain:
```
VITE_API_URL=https://api.yourdomain.com
```

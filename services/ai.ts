// AI Service - DeepSeek Integration via Vite Proxy
import { db } from './db';
import { Order, OrderStatus, OrderItem } from '../types';

const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || '';
// Use Vite dev server proxy to avoid CORS - /deepseek-api proxies to https://api.deepseek.com
const BASE_URL = '/deepseek-api';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface AIAction {
    type: 'create_order' | 'export_stock' | 'import_stock' | 'check_stock' | 'search_product' | 'none';
    data?: any;
    message: string;
    requireConfirmation?: boolean;
}

// System prompt for understanding user intent
const SYSTEM_PROMPT = `Bạn là trợ lý AI cho TaiyoTakamatsu Rental - hệ thống cho thuê thiết bị.

NHIỆM VỤ: Hiểu yêu cầu và trích xuất thông tin. KHÔNG tìm kiếm database.

CÁC LOẠI YÊU CẦU:
1. Tìm/kiểm tra sản phẩm: "tìm bàn", "còn ghế không"
2. Xuất kho: "xuất 5 ghế", "xuất 3 máy chiếu"
3. Nhập kho: "nhập 10 loa"
4. TẠO ĐƠN HÀNG: "tạo đơn cho Minh, 5 ghế từ 25/12 đến 30/12"

TRẢ LỜI BẰNG JSON:
{
  "type": "create_order" | "search_product" | "check_stock" | "export_stock" | "import_stock" | "none",
  "data": {
    // Cho create_order:
    "customerName": "tên khách hàng",
    "customerPhone": "số điện thoại", // optional
    "items": [{"productName": "tên sp", "quantity": số}],
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "note": "ghi chú" // optional
    
    // Cho search/check_stock:
    "query": "từ khóa"
    
    // Cho export/import:
    "productName": "tên sp",
    "quantity": số
  },
  "message": "Mô tả ngắn",
  "requireConfirmation": true // cho create_order
}

VÍ DỤ:
- "tạo đơn cho anh Minh, thuê 5 ghế từ 25/12 đến 30/12" → 
  {"type":"create_order","data":{"customerName":"Minh","items":[{"productName":"ghế","quantity":5}],"startDate":"2024-12-25","endDate":"2024-12-30"},"message":"Tạo đơn cho Minh: 5 ghế (25/12-30/12)","requireConfirmation":true}

- "tìm bàn" → {"type":"search_product","data":{"query":"bàn"},"message":"Tìm sản phẩm bàn"}

QUAN TRỌNG: Với ngày tháng, dùng năm ${new Date().getFullYear()}. Luôn trả lời JSON.`;

export async function sendMessage(messages: ChatMessage[]): Promise<{ response: string; action?: AIAction }> {
    if (!API_KEY) {
        console.error('DeepSeek API key not configured');
        return {
            response: 'Chưa cấu hình API key. Vui lòng thêm VITE_DEEPSEEK_API_KEY vào file .env',
            action: { type: 'none', message: 'Lỗi cấu hình' }
        };
    }

    try {
        console.log('Calling DeepSeek API...');

        const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...messages
                ],
                temperature: 0.3,
                max_tokens: 800
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('DeepSeek API Error:', response.status, error);
            return {
                response: `Lỗi API (${response.status})`,
                action: { type: 'none', message: 'Lỗi API' }
            };
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const action = JSON.parse(jsonMatch[0]) as AIAction;
                return { response: action.message || content, action };
            }
        } catch (e) {
            // Not JSON
        }

        return {
            response: content,
            action: { type: 'none', message: content }
        };
    } catch (error: any) {
        console.error('AI Error:', error);
        return {
            response: `Lỗi: ${error.message}`,
            action: { type: 'none', message: 'Lỗi mạng' }
        };
    }
}

// Preview order before creating - returns detailed info for user confirmation
export function previewOrderAction(action: AIAction): string {
    if (action.type !== 'create_order') return '';

    const { customerName, customerPhone, items, startDate, endDate, note } = action.data || {};

    if (!customerName || !items || items.length === 0 || !startDate || !endDate) {
        return '';
    }

    let preview = `📋 **XÁC NHẬN TẠO ĐƠN HÀNG**\n\n`;

    // Check customer
    const existingCustomer = db.customers.find(c =>
        c.name.toLowerCase().includes(customerName.toLowerCase())
    );
    if (existingCustomer) {
        preview += `👤 Khách hàng: ${existingCustomer.name} (${existingCustomer.phone || 'N/A'})\n`;
    } else {
        preview += `👤 Khách hàng: ${customerName} ⚠️ (SẼ TẠO MỚI)\n`;
        if (customerPhone) preview += `   📱 SĐT: ${customerPhone}\n`;
    }

    preview += `📅 Thời gian: ${startDate} → ${endDate}\n\n`;
    preview += `📦 **Sản phẩm:**\n`;

    const foundProducts: { name: string; code: string; qty: number; stock: number }[] = [];
    const notFoundProducts: string[] = [];

    for (const item of items) {
        const searchTerm = String(item.productName).toLowerCase();
        const product = db.products.find(p =>
            p.code.toLowerCase().includes(searchTerm) ||
            p.name.toLowerCase().includes(searchTerm)
        );

        if (product) {
            foundProducts.push({
                name: product.name,
                code: product.code,
                qty: item.quantity || 1,
                stock: product.currentPhysicalStock
            });
        } else {
            notFoundProducts.push(item.productName);
        }
    }

    for (const p of foundProducts) {
        const stockOk = p.stock >= p.qty;
        preview += `   ${stockOk ? '✅' : '⚠️'} ${p.code}: ${p.name}\n`;
        preview += `      Số lượng: ${p.qty} (Tồn kho: ${p.stock})\n`;
    }

    if (notFoundProducts.length > 0) {
        preview += `\n❌ **Không tìm thấy:**\n`;
        for (const name of notFoundProducts) {
            preview += `   - ${name}\n`;
        }
    }

    if (note) {
        preview += `\n📝 Ghi chú: ${note}\n`;
    }

    if (foundProducts.length === 0) {
        preview += `\n⛔ Không có sản phẩm nào hợp lệ. Vui lòng kiểm tra lại.`;
    }

    return preview;
}

// Execute AI action
export async function executeAction(action: AIAction, refreshApp: () => void): Promise<string> {
    try {
        switch (action.type) {
            case 'create_order': {
                const { customerName, customerPhone, items, startDate, endDate, note } = action.data || {};

                if (!customerName) return '❌ Vui lòng cho biết tên khách hàng';
                if (!items || items.length === 0) return '❌ Vui lòng cho biết sản phẩm cần thuê';
                if (!startDate || !endDate) return '❌ Vui lòng cho biết ngày bắt đầu và kết thúc';

                // 1. Find or create customer
                let customer = db.customers.find(c =>
                    c.name.toLowerCase().includes(customerName.toLowerCase())
                );

                if (!customer) {
                    // Create new customer
                    customer = await db.addCustomer({
                        name: customerName,
                        phone: customerPhone || ''
                    });
                }

                // 2. Find products and build order items
                const orderItems: OrderItem[] = [];
                const notFound: string[] = [];

                for (const item of items) {
                    const searchTerm = String(item.productName).toLowerCase();
                    const product = db.products.find(p =>
                        p.code.toLowerCase().includes(searchTerm) ||
                        p.name.toLowerCase().includes(searchTerm)
                    );

                    if (product) {
                        orderItems.push({
                            itemId: '',
                            productId: product.id,
                            quantity: item.quantity || 1,
                            isExternal: false,
                            exportedQuantity: 0,
                            returnedQuantity: 0
                        });
                    } else {
                        notFound.push(item.productName);
                    }
                }

                if (orderItems.length === 0) {
                    return `❌ Không tìm thấy sản phẩm: ${notFound.join(', ')}`;
                }

                // 3. Create order
                const order: Order = {
                    id: 0,
                    customerId: customer.id,
                    rentalStartDate: startDate,
                    expectedReturnDate: endDate,
                    status: OrderStatus.BOOKED,
                    items: orderItems,
                    totalAmount: 0,
                    note: note || `Tạo qua AI bởi ${db.currentUser?.name || 'AI'}`
                };

                const createdOrder = await db.createOrder(order);
                refreshApp();

                let response = `✅ Đã tạo đơn hàng #${createdOrder.id}\n`;
                response += `👤 Khách: ${customer.name}\n`;
                response += `📅 ${startDate} → ${endDate}\n`;
                response += `📦 Sản phẩm:\n`;

                for (const item of orderItems) {
                    const product = db.products.find(p => p.id === item.productId);
                    response += `   - ${product?.name}: x${item.quantity}\n`;
                }

                if (notFound.length > 0) {
                    response += `\n⚠️ Không tìm thấy: ${notFound.join(', ')}`;
                }

                return response;
            }

            case 'export_stock': {
                const { productName, quantity, orderId, note } = action.data || {};
                if (!productName) return '❌ Vui lòng cho biết tên sản phẩm';
                if (!quantity || quantity <= 0) return '❌ Vui lòng cho biết số lượng';

                const searchTerm = String(productName).toLowerCase();
                const product = db.products.find(p =>
                    p.code.toLowerCase().includes(searchTerm) ||
                    p.name.toLowerCase().includes(searchTerm)
                );

                if (!product) return `❌ Không tìm thấy: ${productName}`;
                if (quantity > product.currentPhysicalStock) {
                    return `❌ Không đủ hàng. ${product.name} còn ${product.currentPhysicalStock}`;
                }

                await db.exportStock(orderId || 0, product.id, quantity, note || 'Xuất qua AI');
                refreshApp();
                return `✅ Đã xuất ${quantity} ${product.name}`;
            }

            case 'import_stock': {
                const { productName, quantity, orderId, note } = action.data || {};
                if (!productName) return '❌ Vui lòng cho biết tên sản phẩm';
                if (!quantity || quantity <= 0) return '❌ Vui lòng cho biết số lượng';

                const searchTerm = String(productName).toLowerCase();
                const product = db.products.find(p =>
                    p.code.toLowerCase().includes(searchTerm) ||
                    p.name.toLowerCase().includes(searchTerm)
                );

                if (!product) return `❌ Không tìm thấy: ${productName}`;

                await db.importStock(orderId || 0, product.id, quantity, note || 'Nhập qua AI');
                refreshApp();
                return `✅ Đã nhập ${quantity} ${product.name}`;
            }

            case 'check_stock':
            case 'search_product': {
                const { query } = action.data || {};
                const searchTerm = String(query || '').toLowerCase();

                if (!searchTerm) return '❌ Vui lòng cho biết từ khóa';

                const products = db.products.filter(p =>
                    p.name.toLowerCase().includes(searchTerm) ||
                    p.code.toLowerCase().includes(searchTerm)
                );

                if (products.length === 0) {
                    return `❌ Không tìm thấy: "${searchTerm}"`;
                }

                const results = products.slice(0, 15);
                let response = `🔍 ${products.length} sản phẩm:\n\n`;
                response += results.map(p => {
                    const s = p.currentPhysicalStock;
                    return `${s === 0 ? '🔴' : s <= 2 ? '🟡' : '🟢'} ${p.code}: ${p.name} (${s}/${p.totalOwned})`;
                }).join('\n');

                if (products.length > 15) response += `\n... +${products.length - 15}`;
                return response;
            }

            default:
                return action.message || '💡 Tôi có thể:\n- Tìm sản phẩm: "tìm bàn"\n- Kiểm kho: "còn ghế không"\n- Xuất/nhập: "xuất 5 máy chiếu"\n- Tạo đơn: "tạo đơn cho Minh, 5 ghế từ 25/12 đến 30/12"';
        }
    } catch (error: any) {
        console.error('Execute action error:', error);
        return `❌ Lỗi: ${error.message}`;
    }
}

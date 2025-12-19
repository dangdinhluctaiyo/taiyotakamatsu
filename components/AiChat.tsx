import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../services/db';
import { t } from '../services/i18n';
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles, AlertCircle } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export const AiChat: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
    const [showKeyInput, setShowKeyInput] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const getSystemContext = () => {
        const products = db.products.slice(0, 50).map(p => ({
            name: p.name,
            code: p.code,
            stock: p.currentPhysicalStock,
            total: p.totalOwned,
            location: p.location
        }));

        const recentOrders = db.orders.slice(0, 20).map(o => {
            const customer = db.customers.find(c => c.id === o.customerId);
            return {
                id: o.id,
                customer: customer?.name,
                status: o.status,
                start: o.rentalStartDate,
                end: o.expectedReturnDate,
                items: o.items.map(i => {
                    const p = db.products.find(x => x.id === i.productId);
                    return { name: p?.name, qty: i.quantity };
                })
            };
        });

        return `Bạn là trợ lý AI cho hệ thống cho thuê thiết bị TaiyoTakamatsu.
Trả lời bằng tiếng Việt hoặc tiếng Nhật tùy theo ngôn ngữ của câu hỏi.
Trả lời ngắn gọn, chính xác.

Dữ liệu hiện tại:
- Tổng sản phẩm: ${db.products.length}
- Tổng đơn hàng: ${db.orders.length}
- Đơn đang hoạt động: ${db.orders.filter(o => o.status === 'ACTIVE').length}
- Đơn quá hạn: ${db.orders.filter(o => o.status === 'ACTIVE' && new Date(o.expectedReturnDate) < new Date()).length}

Sản phẩm (mẫu):
${JSON.stringify(products.slice(0, 10), null, 2)}

Đơn hàng gần đây:
${JSON.stringify(recentOrders.slice(0, 5), null, 2)}`;
    };

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;
        if (!apiKey) {
            setShowKeyInput(true);
            return;
        }

        const userMessage: Message = { role: 'user', content: input.trim(), timestamp: new Date() };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

            const chat = model.startChat({
                history: messages.map(m => ({
                    role: m.role === 'user' ? 'user' : 'model',
                    parts: [{ text: m.content }]
                })),
                generationConfig: { maxOutputTokens: 1000 }
            });

            const context = getSystemContext();
            const result = await chat.sendMessage(`${context}\n\nCâu hỏi: ${userMessage.content}`);
            const response = await result.response;

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response.text(),
                timestamp: new Date()
            }]);
        } catch (e: any) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `❌ Lỗi: ${e.message || 'Không thể kết nối AI'}`,
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const saveApiKey = () => {
        localStorage.setItem('gemini_api_key', apiKey);
        setShowKeyInput(false);
    };

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-20 md:bottom-6 right-4 md:right-6 w-14 h-14 bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center z-50"
            >
                <Sparkles className="w-6 h-6" />
            </button>

            {/* Chat Modal */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
                    <div className="bg-white w-full md:w-[420px] h-[85vh] md:h-[600px] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Bot className="w-5 h-5" />
                                <span className="font-bold">AI Assistant</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowKeyInput(!showKeyInput)}
                                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                    title="API Key"
                                >
                                    <AlertCircle className="w-4 h-4" />
                                </button>
                                <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* API Key Input */}
                        {showKeyInput && (
                            <div className="p-3 bg-amber-50 border-b flex gap-2">
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={e => setApiKey(e.target.value)}
                                    placeholder="Gemini API Key"
                                    className="flex-1 px-3 py-2 rounded-lg border text-sm"
                                />
                                <button onClick={saveApiKey} className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium">
                                    Lưu
                                </button>
                            </div>
                        )}

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                            {messages.length === 0 && (
                                <div className="text-center text-slate-400 py-8">
                                    <Bot className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                    <p className="font-medium">Xin chào! Tôi có thể giúp gì?</p>
                                    <p className="text-sm mt-1">Hỏi về đơn hàng, tồn kho, khách hàng...</p>
                                </div>
                            )}

                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                    {msg.role === 'assistant' && (
                                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                                            <Bot className="w-4 h-4 text-purple-600" />
                                        </div>
                                    )}
                                    <div className={`max-w-[80%] px-4 py-2 rounded-2xl ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-br-md'
                                        : 'bg-white border shadow-sm rounded-bl-md'
                                        }`}>
                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                    {msg.role === 'user' && (
                                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                                            <User className="w-4 h-4 text-indigo-600" />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {isLoading && (
                                <div className="flex gap-2">
                                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                        <Bot className="w-4 h-4 text-purple-600" />
                                    </div>
                                    <div className="bg-white border shadow-sm px-4 py-3 rounded-2xl rounded-bl-md">
                                        <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-3 border-t bg-white">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                    placeholder="Nhập câu hỏi..."
                                    className="flex-1 px-4 py-3 rounded-xl border focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                                    disabled={isLoading}
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={isLoading || !input.trim()}
                                    className="px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import { sendMessage, executeAction, previewOrderAction, ChatMessage, AIAction } from '../services/ai';
import { t } from '../services/i18n';

interface Props {
    refreshApp: () => void;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    action?: AIAction;
    status?: 'pending' | 'success' | 'error';
}

export const AIChat: React.FC<Props> = ({ refreshApp }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const chatHistory: ChatMessage[] = messages.map(m => ({
                role: m.role,
                content: m.content
            }));
            chatHistory.push({ role: 'user', content: userMessage.content });

            const { response, action } = await sendMessage(chatHistory);

            // For create_order, show preview first and require confirmation
            if (action && action.type === 'create_order') {
                const preview = previewOrderAction(action);
                if (preview) {
                    const previewMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: preview,
                        action: { ...action, requireConfirmation: true }
                    };
                    setMessages(prev => [...prev, previewMessage]);
                } else {
                    setMessages(prev => [...prev, {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: '❌ Thiếu thông tin. Vui lòng thử lại với đầy đủ: tên khách, sản phẩm, ngày.',
                        status: 'error'
                    }]);
                }
            }
            // For other actions, auto-execute if no confirmation needed
            else if (action && action.type !== 'none' && !action.requireConfirmation) {
                const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: response,
                    action
                };
                setMessages(prev => [...prev, assistantMessage]);

                const result = await executeAction(action, refreshApp);
                const resultMessage: Message = {
                    id: (Date.now() + 2).toString(),
                    role: 'assistant',
                    content: result,
                    status: result.startsWith('✅') ? 'success' : result.startsWith('❌') ? 'error' : undefined
                };
                setMessages(prev => [...prev, resultMessage]);
            }
            // Just show response
            else {
                const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: response,
                    action
                };
                setMessages(prev => [...prev, assistantMessage]);
            }

        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Xin lỗi, đã xảy ra lỗi. Vui lòng thử lại.',
                status: 'error'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExecuteAction = async (action: AIAction) => {
        setIsLoading(true);
        try {
            const result = await executeAction(action, refreshApp);
            const resultMessage: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: result,
                status: result.startsWith('✅') ? 'success' : result.startsWith('❌') ? 'error' : undefined
            };
            setMessages(prev => [...prev, resultMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const quickActions = [
        { label: '📦 Kiểm tra tồn kho', prompt: 'Kiểm tra tồn kho' },
        { label: ' Tìm sản phẩm', prompt: 'Tìm sản phẩm' },
    ];

    return (
        <>
            {/* Chat Button - positioned above scroll-to-top button */}
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-40 right-4 md:bottom-20 md:right-6 z-40 w-14 h-14 bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-all active:scale-95 ${isOpen ? 'hidden' : ''}`}
            >
                <Sparkles className="w-6 h-6" />
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed inset-0 z-50 md:inset-auto md:bottom-6 md:right-6 md:w-96 md:h-[600px] md:max-h-[80vh] bg-white md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                <Bot className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold">AI Assistant</h3>
                                <p className="text-xs text-purple-200">Hỗ trợ xuất nhập kho</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                        {messages.length === 0 && (
                            <div className="text-center py-8">
                                <Bot className="w-12 h-12 text-purple-300 mx-auto mb-3" />
                                <p className="text-gray-500 text-sm mb-4">
                                    Xin chào! Tôi có thể giúp bạn:
                                </p>
                                <div className="space-y-2">
                                    {quickActions.map((action, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                setInput(action.prompt);
                                            }}
                                            className="block w-full text-left px-4 py-2.5 bg-white rounded-xl text-sm text-gray-700 hover:bg-purple-50 transition-colors border"
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                                        <Bot className="w-4 h-4 text-purple-600" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${msg.role === 'user'
                                        ? 'bg-purple-600 text-white rounded-br-md'
                                        : msg.status === 'success'
                                            ? 'bg-green-100 text-green-800 rounded-bl-md'
                                            : msg.status === 'error'
                                                ? 'bg-red-100 text-red-800 rounded-bl-md'
                                                : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                                        }`}
                                >
                                    <p className="whitespace-pre-wrap">{msg.content}</p>

                                    {/* Action buttons */}
                                    {msg.action && msg.action.requireConfirmation && msg.action.type !== 'none' && (
                                        <div className="mt-3 flex gap-2">
                                            <button
                                                onClick={() => handleExecuteAction(msg.action!)}
                                                disabled={isLoading}
                                                className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600"
                                            >
                                                <CheckCircle className="w-4 h-4" /> Xác nhận tạo đơn
                                            </button>
                                            <button
                                                onClick={() => setMessages(prev => [...prev, {
                                                    id: Date.now().toString(),
                                                    role: 'assistant',
                                                    content: '❌ Đã hủy.',
                                                    status: 'error'
                                                }])}
                                                className="flex items-center gap-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-300"
                                            >
                                                <X className="w-4 h-4" /> Hủy
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {msg.role === 'user' && (
                                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                                        <User className="w-4 h-4 text-gray-600" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex gap-2">
                                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-purple-600" />
                                </div>
                                <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                                    <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input - with extra padding for mobile tab bar */}
                    <div className="p-4 bg-white border-t shrink-0 pb-24 md:pb-4">
                        <div className="flex gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Nhập tin nhắn..."
                                className="flex-1 px-4 py-3 bg-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                className="w-12 h-12 bg-purple-600 text-white rounded-xl flex items-center justify-center hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 text-center">
                            Powered by DeepSeek AI
                        </p>
                    </div>
                </div>
            )}
        </>
    );
};

"use client";

import { useState, useEffect, useRef } from "react";
import Header from "@/components/layout/Header";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { cn, getInitials, formatDateTime } from "@/lib/utils";

interface ChatContact {
  id: string;
  name: string;
  email: string;
  unreadCount: number;
  lastMessage: { content: string; createdAt: string } | null;
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: { id: string; name: string; role: string };
}

export default function TelecallerChatPage() {
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [selected, setSelected] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchContacts(); }, []);
  useEffect(() => { if (selected) fetchMessages(selected.id); }, [selected]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const fetchContacts = async () => {
    const res = await fetch("/api/messages");
    const data = await res.json();
    setContacts(data);
    setLoading(false);
    if (data.length > 0 && !selected) setSelected(data[0]);
  };

  const fetchMessages = async (userId: string) => {
    const res = await fetch(`/api/messages?userId=${userId}`);
    setMessages(await res.json());
    fetchContacts();
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selected) return;
    setSending(true);
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: selected.id, content: newMessage.trim() }),
    });
    setNewMessage("");
    setSending(false);
    fetchMessages(selected.id);
  };

  return (
    <>
      <Header title="Messages" subtitle="Chat with your admin" />
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden flex" style={{ height: "calc(100vh - 160px)" }}>
          {/* Contact List */}
          <div className="w-72 border-r border-slate-100 flex flex-col">
            <div className="p-4 border-b border-slate-50">
              <h3 className="font-semibold text-slate-900 text-sm">Admins</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={20} className="animate-spin text-slate-400" />
                </div>
              ) : contacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-50",
                    selected?.id === c.id && "bg-indigo-50"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                    {getInitials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                      {c.unreadCount > 0 && (
                        <span className="bg-indigo-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{c.unreadCount}</span>
                      )}
                    </div>
                    {c.lastMessage && <p className="text-xs text-slate-400 truncate">{c.lastMessage.content}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 flex flex-col">
            {selected ? (
              <>
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                    {getInitials(selected.name)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{selected.name}</p>
                    <p className="text-xs text-slate-400">Admin</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.map((msg) => {
                    const isMine = msg.sender.role === "TELECALLER";
                    return (
                      <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[70%] px-4 py-2.5 rounded-2xl text-sm",
                          isMine ? "bg-emerald-600 text-white rounded-br-md" : "bg-slate-100 text-slate-900 rounded-bl-md"
                        )}>
                          <p>{msg.content}</p>
                          <p className={cn("text-[10px] mt-1", isMine ? "text-emerald-200" : "text-slate-400")}>{formatDateTime(msg.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
                <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                  <button onClick={sendMessage} disabled={sending || !newMessage.trim()} className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="text-sm">Select an admin to chat</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

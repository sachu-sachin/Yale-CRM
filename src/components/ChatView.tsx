"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { cn, getInitials, formatDateTime } from "@/lib/utils";

interface ChatContact {
  id: string;
  name: string;
  email: string;
  isActive?: boolean;
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

export default function ChatView() {
  const { data: session } = useSession();
  const myId = (session?.user as { id?: string } | undefined)?.id || "";
  const myRole = (session?.user as { role?: string } | undefined)?.role || "TELECALLER";

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Contacts list — polled so unread counts / last message stay fresh.
  const { data: contacts = [], isLoading: contactsLoading, mutate: mutateContacts } =
    useSWR<ChatContact[]>("/api/messages", { refreshInterval: 5000 });

  const selected = contacts.find((c) => c.id === selectedId) || null;

  // Active conversation — polled every 2.5s so incoming messages appear live.
  const { data: messages = [], mutate: mutateMessages } = useSWR<Message[]>(
    selectedId ? `/api/messages?userId=${selectedId}` : null,
    { refreshInterval: 2500 }
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // When opening a conversation, refresh contacts so the unread badge clears.
  useEffect(() => {
    if (selectedId) mutateContacts();
  }, [selectedId, mutateContacts]);

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !selectedId) return;
    setNewMessage("");
    setSending(true);

    // Optimistic: show the message immediately.
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      senderId: myId,
      content: text,
      createdAt: new Date().toISOString(),
      sender: { id: myId, name: "You", role: myRole },
    };
    mutateMessages([...(messages || []), optimistic], { revalidate: false });

    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: selectedId, content: text }),
      });
    } catch {
      /* keep optimistic; next poll reconciles */
    } finally {
      setSending(false);
      mutateMessages(); // reconcile with server (replaces temp id)
      mutateContacts(); // update last-message preview
    }
  };

  return (
    <>
      <Header title="Messages" subtitle="Direct chat" />
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden flex" style={{ height: "calc(100vh - 160px)" }}>
          {/* Contact List */}
          <div className="w-80 border-r border-slate-100 flex flex-col">
            <div className="p-4 border-b border-slate-50">
              <h3 className="font-semibold text-slate-900 text-sm">{myRole === "ADMIN" ? "Telecallers" : "Admins"}</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {contactsLoading ? (
                <div className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
              ) : (
                contacts.map((contact) => (
                  <button key={contact.id} onClick={() => setSelectedId(contact.id)}
                    className={cn("w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-50",
                      selectedId === contact.id && "bg-indigo-50 hover:bg-indigo-50")}>
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                        {getInitials(contact.name)}
                      </div>
                      {contact.isActive && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-900 truncate">{contact.name}</p>
                        {contact.unreadCount > 0 && (
                          <span className="bg-indigo-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{contact.unreadCount}</span>
                        )}
                      </div>
                      {contact.lastMessage && <p className="text-xs text-slate-400 truncate">{contact.lastMessage.content}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {selected ? (
              <>
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">{getInitials(selected.name)}</div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{selected.name}</p>
                    <p className="text-xs text-slate-400">{selected.email}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.map((msg) => {
                    const isMine = msg.senderId === myId;
                    return (
                      <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[70%] px-4 py-2.5 rounded-2xl text-sm",
                          isMine ? "bg-indigo-600 text-white rounded-br-md" : "bg-slate-100 text-slate-900 rounded-bl-md")}>
                          <p>{msg.content}</p>
                          <p className={cn("text-[10px] mt-1", isMine ? "text-indigo-200" : "text-slate-400")}>{formatDateTime(msg.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                  <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                  <button onClick={sendMessage} disabled={sending || !newMessage.trim()}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="text-sm">Select a conversation to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

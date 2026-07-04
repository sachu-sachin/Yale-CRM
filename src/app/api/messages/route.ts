import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/messages?userId=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user?.id as string;
  const { searchParams } = new URL(req.url);
  const otherUserId = searchParams.get("userId");

  if (otherUserId) {
    // Get conversation between current user and specified user
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        receiver: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Mark received messages as read
    await prisma.message.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return NextResponse.json(messages);
  }

  // Get list of conversations (unique users the current user has chatted with)
  const role = (session.user as { role: string }).role;

  if (role === "ADMIN") {
    // Admin sees all telecallers with unread counts
    const telecallers = await prisma.user.findMany({
      where: { role: "TELECALLER" },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
    });

    const withUnread = await Promise.all(
      telecallers.map(async (tc) => {
        const unread = await prisma.message.count({
          where: {
            senderId: tc.id,
            receiverId: userId,
            isRead: false,
          },
        });
        const lastMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: tc.id },
              { senderId: tc.id, receiverId: userId },
            ],
          },
          orderBy: { createdAt: "desc" },
          select: { content: true, createdAt: true },
        });
        return { ...tc, unreadCount: unread, lastMessage };
      })
    );

    return NextResponse.json(withUnread);
  } else {
    // Telecaller sees admins with unread counts
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const withUnread = await Promise.all(
      admins.map(async (admin) => {
        const unread = await prisma.message.count({
          where: {
            senderId: admin.id,
            receiverId: userId,
            isRead: false,
          },
        });
        const lastMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: admin.id },
              { senderId: admin.id, receiverId: userId },
            ],
          },
          orderBy: { createdAt: "desc" },
          select: { content: true, createdAt: true },
        });
        return { ...admin, unreadCount: unread, lastMessage };
      })
    );

    return NextResponse.json(withUnread);
  }
}

// POST /api/messages
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { receiverId, content } = body;

  if (!receiverId || !content) {
    return NextResponse.json(
      { error: "Receiver and content are required" },
      { status: 400 }
    );
  }

  const message = await prisma.message.create({
    data: {
      senderId: session.user?.id as string,
      receiverId,
      content,
    },
    include: {
      sender: { select: { id: true, name: true, role: true } },
      receiver: { select: { id: true, name: true, role: true } },
    },
  });

  // Notify the receiver
  await prisma.notification.create({
    data: {
      userId: receiverId,
      type: "MESSAGE",
      title: `New message from ${message.sender.name}`,
      body: content.slice(0, 90),
      link: message.receiver.role === "ADMIN" ? "/admin/chat" : "/telecaller/chat",
    },
  });

  return NextResponse.json(message, { status: 201 });
}

import type { Role, LeadStatus, LeadSource, Priority, CallOutcome } from "@prisma/client";

export type { Role, LeadStatus, LeadSource, Priority, CallOutcome };

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface LeadWithRelations {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  altPhone: string | null;
  source: LeadSource;
  serviceInterest: string[];
  city: string | null;
  budgetRange: string | null;
  status: LeadStatus;
  priority: Priority;
  notes: string | null;
  assignedToId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  assignedTo: { id: string; name: string; email: string } | null;
  createdBy: { id: string; name: string };
  _count?: { callLogs: number };
}

export interface TargetWithProgress {
  id: string;
  telecallerId: string;
  month: number;
  year: number;
  targetCalls: number;
  targetConverts: number;
  bonusAmount: number;
  achievedBonus: boolean;
  actualCalls: number;
  actualConverts: number;
  telecaller: { id: string; name: string; email: string };
}

export interface MessageWithUsers {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
  sender: { id: string; name: string; role: Role };
  receiver: { id: string; name: string; role: Role };
}

export interface AnnouncementWithAuthor {
  id: string;
  title: string;
  content: string;
  createdById: string;
  createdAt: Date;
  createdBy: { id: string; name: string };
}

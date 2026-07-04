import type { Role, LeadSource, AdPhase, DealStatus } from "@prisma/client";

export type { Role, LeadSource, AdPhase, DealStatus };

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface TargetWithProgress {
  id: string;
  telecallerId: string;
  month: number;
  year: number;
  targetLeads: number;
  targetConverts: number;
  bonusAmount: number;
  achievedBonus: boolean;
  actualLeads: number;
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

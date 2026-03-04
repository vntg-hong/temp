/**
 * DutchPay 도메인 API
 *
 * 공유 정산방 CRUD + 비밀번호 검증 + 폴링
 */

import { apiClient } from '../../core/api';
import type { Member, Expense } from './types';

export interface GroupPayload {
  title?: string;
  budget?: number;
  members?: Member[];
  expenses?: Expense[];
  completed_settlements?: string[];
  is_locked?: boolean;
  password?: string;
}

export interface GroupData {
  id: string;
  title: string;
  budget: number;
  members: Member[];
  expenses: Expense[];
  completed_settlements: string[];
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export const dutchpayApi = {
  /** 공유 정산방 생성 → UUID 반환 */
  createGroup: async (payload: GroupPayload): Promise<GroupData> => {
    const res = await apiClient.post<GroupData>('/v1/dutchpay', payload);
    return res.data;
  },

  /** UUID로 정산방 조회 */
  getGroup: async (groupId: string): Promise<GroupData> => {
    const res = await apiClient.get<GroupData>(`/v1/dutchpay/${groupId}`);
    return res.data;
  },

  /** 정산방 데이터 부분 수정 */
  updateGroup: async (groupId: string, payload: GroupPayload): Promise<GroupData> => {
    const res = await apiClient.patch<GroupData>(`/v1/dutchpay/${groupId}`, payload);
    return res.data;
  },

  /** 비밀번호 검증 — 성공 시 true, 실패 시 false */
  verifyPassword: async (groupId: string, password: string): Promise<boolean> => {
    try {
      await apiClient.post(`/v1/dutchpay/${groupId}/verify`, { password });
      return true;
    } catch {
      return false;
    }
  },

  /** 폴링 — updated_at 만 반환 (로딩 오버레이 미표시) */
  pollGroup: async (groupId: string): Promise<string> => {
    const res = await apiClient.get<{ updated_at: string }>(
      `/v1/dutchpay/${groupId}/poll`,
      { skipLoading: true } as never,
    );
    return res.data.updated_at;
  },
};

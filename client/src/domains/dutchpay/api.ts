/**
 * DutchPay 도메인 API
 *
 * Supabase JS 클라이언트로 settlement_groups 테이블에 직접 접근합니다.
 * (FastAPI 서버 불필요)
 */

import { supabase } from '../../core/supabase/client';
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

const SELECT_COLS =
  'id, title, budget, members, expenses, completed_settlements, is_locked, created_at, updated_at, expires_at';

export const dutchpayApi = {
  /** 공유 정산방 생성 → UUID 반환 */
  createGroup: async (payload: GroupPayload): Promise<GroupData> => {
    const { data, error } = await supabase
      .from('settlement_groups')
      .insert({
        title: payload.title ?? '정산',
        budget: payload.budget ?? 0,
        members: payload.members ?? [],
        expenses: payload.expenses ?? [],
        completed_settlements: payload.completed_settlements ?? [],
      })
      .select(SELECT_COLS)
      .single();

    if (error) throw error;
    return data as GroupData;
  },

  /** UUID로 정산방 조회 */
  getGroup: async (groupId: string): Promise<GroupData> => {
    const { data, error } = await supabase
      .from('settlement_groups')
      .select(SELECT_COLS)
      .eq('id', groupId)
      .single();

    if (error) throw error;
    return data as GroupData;
  },

  /** 정산방 데이터 부분 수정 */
  updateGroup: async (groupId: string, payload: GroupPayload): Promise<GroupData> => {
    const updates: Record<string, unknown> = {};
    if (payload.title !== undefined) updates.title = payload.title;
    if (payload.budget !== undefined) updates.budget = payload.budget;
    if (payload.members !== undefined) updates.members = payload.members;
    if (payload.expenses !== undefined) updates.expenses = payload.expenses;
    if (payload.completed_settlements !== undefined)
      updates.completed_settlements = payload.completed_settlements;
    if (payload.is_locked !== undefined) updates.is_locked = payload.is_locked;

    const { data, error } = await supabase
      .from('settlement_groups')
      .update(updates)
      .eq('id', groupId)
      .select(SELECT_COLS)
      .single();

    if (error) throw error;
    return data as GroupData;
  },

  /**
   * 비밀번호 검증 — Supabase RPC 함수 verify_group_password 필요
   * Supabase 대시보드 SQL Editor에서 아래를 실행해야 합니다:
   *
   * CREATE EXTENSION IF NOT EXISTS pgcrypto;
   * CREATE OR REPLACE FUNCTION verify_group_password(group_id UUID, input_password TEXT)
   * RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
   *   SELECT password_hash = crypt(input_password, password_hash)
   *   FROM settlement_groups WHERE id = group_id;
   * $$;
   */
  verifyPassword: async (groupId: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('verify_group_password', {
        group_id: groupId,
        input_password: password,
      });
      if (error) return false;
      return data === true;
    } catch {
      return false;
    }
  },

  /** 폴링 — updated_at 만 반환 */
  pollGroup: async (groupId: string): Promise<string> => {
    const { data, error } = await supabase
      .from('settlement_groups')
      .select('updated_at')
      .eq('id', groupId)
      .single();

    if (error) throw error;
    return (data as { updated_at: string }).updated_at;
  },
};

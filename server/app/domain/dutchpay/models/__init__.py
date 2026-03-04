"""
DutchPay 도메인 ORM 모델
"""

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMPTZ, UUID
from sqlalchemy.orm import Mapped, mapped_column

from server.app.core.database import Base


class SettlementGroup(Base):
    """
    공유 정산방 테이블

    UUID 기반 공유 URL을 통해 여러 명이 실시간으로 협업하는 정산 그룹.
    members / expenses 는 JSONB로 저장하여 항상 그룹 전체 데이터를 단일 쿼리로 처리.
    """

    __tablename__ = "settlement_groups"

    # Primary Key: URL에 노출되는 고유 공유 식별자
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="공유 URL 식별자 (UUID v4)",
    )

    # 정산 제목
    title: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="정산",
        comment="정산방 제목",
    )

    # 초기 예산 (KRW 기준)
    budget: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="초기 예산 (KRW)",
    )

    # 참여자 목록: [{id: str, name: str}]
    members: Mapped[Any] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default="'[]'::jsonb",
        comment="참여자 목록",
    )

    # 지출 내역: [{id, title, amount, currency, exchangeRate, payerId, splitType, date, participants}]
    expenses: Mapped[Any] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default="'[]'::jsonb",
        comment="지출 내역 목록",
    )

    # 완료된 정산 키 목록: ["from::to::amount"]
    completed_settlements: Mapped[Any] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default="'[]'::jsonb",
        comment="완료 처리된 정산 키 목록",
    )

    # 잠금 여부
    is_locked: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="비밀번호 잠금 여부",
    )

    # bcrypt 해시. NULL이면 잠금 없음
    password_hash: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="bcrypt 해시 비밀번호 (NULL = 잠금 없음)",
    )

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ,
        nullable=False,
        server_default=func.now(),
        comment="생성 일시",
    )

    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMPTZ,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        comment="최종 수정 일시 (폴링 기준)",
    )

    # 만료 일시. NULL이면 영구 보관
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMPTZ,
        nullable=True,
        default=None,
        comment="만료 일시 (NULL = 영구 보관)",
    )

    def __repr__(self) -> str:
        return f"<SettlementGroup(id={self.id}, title='{self.title}', locked={self.is_locked})>"

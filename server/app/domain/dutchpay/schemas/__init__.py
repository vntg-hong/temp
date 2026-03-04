"""
DutchPay 도메인 스키마

API 요청/응답 및 Repository DTO를 정의합니다.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from server.app.shared.types import RepositoryInput, RepositoryOutput


# ── API Request ───────────────────────────────────────────────────────────────


class CreateGroupRequest(BaseModel):
    title: str = "정산"
    budget: int = 0
    members: list[dict[str, Any]] = []
    expenses: list[dict[str, Any]] = []
    completed_settlements: list[str] = []
    is_locked: bool = False
    password: str | None = None  # 평문. Service에서 bcrypt 해시화


class UpdateGroupRequest(BaseModel):
    title: str | None = None
    budget: int | None = None
    members: list[dict[str, Any]] | None = None
    expenses: list[dict[str, Any]] | None = None
    completed_settlements: list[str] | None = None
    is_locked: bool | None = None
    password: str | None = None  # None = 변경 없음


class VerifyPasswordRequest(BaseModel):
    password: str


# ── API Response ──────────────────────────────────────────────────────────────


class GroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    budget: int
    members: list[dict[str, Any]]
    expenses: list[dict[str, Any]]
    completed_settlements: list[str]
    is_locked: bool
    created_at: datetime
    updated_at: datetime
    expires_at: datetime | None


class PollResponse(BaseModel):
    updated_at: datetime


# ── Repository DTOs ───────────────────────────────────────────────────────────


class CreateGroupInput(RepositoryInput):
    title: str
    budget: int
    members: list[dict[str, Any]]
    expenses: list[dict[str, Any]]
    completed_settlements: list[str]
    is_locked: bool
    password_hash: str | None


class CreateGroupOutput(RepositoryOutput):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    group: Any  # SettlementGroup ORM 인스턴스


class GetGroupInput(RepositoryInput):
    group_id: UUID


class GetGroupOutput(RepositoryOutput):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    group: Any | None  # SettlementGroup ORM 인스턴스 또는 None


class UpdateGroupInput(RepositoryInput):
    group_id: UUID
    updates: dict[str, Any]


class UpdateGroupOutput(RepositoryOutput):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    group: Any  # 수정된 SettlementGroup ORM 인스턴스

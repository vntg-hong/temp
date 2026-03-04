"""
DutchPay 서비스

비즈니스 로직 오케스트레이션 (비밀번호 해시화, 검증 등)을 담당합니다.
"""

from typing import Any
from uuid import UUID

from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.shared.base import BaseService
from server.app.shared.types import ServiceResult
from server.app.domain.dutchpay.schemas import (
    CreateGroupRequest,
    GroupResponse,
    PollResponse,
    UpdateGroupInput,
    GetGroupInput,
    CreateGroupInput,
    VerifyPasswordRequest,
)
from server.app.domain.dutchpay.repositories import (
    CreateGroupRepository,
    GetGroupRepository,
    UpdateGroupRepository,
)

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


class CreateGroupService(BaseService[CreateGroupRequest, GroupResponse]):
    """정산 그룹 생성 서비스 — 잠금 설정 시 비밀번호를 bcrypt 해시화"""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db)
        self.repo = CreateGroupRepository(db)

    async def execute(
        self, request: CreateGroupRequest, **kwargs: Any
    ) -> ServiceResult[GroupResponse]:
        try:
            is_locked = request.is_locked and bool(request.password)
            password_hash: str | None = None
            if is_locked:
                password_hash = _pwd_ctx.hash(request.password)  # type: ignore[arg-type]

            output = await self.repo.provide(
                CreateGroupInput(
                    title=request.title,
                    budget=request.budget,
                    members=request.members,
                    expenses=request.expenses,
                    completed_settlements=request.completed_settlements,
                    is_locked=is_locked,
                    password_hash=password_hash,
                )
            )
            return ServiceResult.ok(GroupResponse.model_validate(output.group))
        except Exception as e:
            return ServiceResult.fail(str(e))


class GetGroupService(BaseService[GetGroupInput, GroupResponse]):
    """UUID로 정산 그룹 조회"""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db)
        self.repo = GetGroupRepository(db)

    async def execute(
        self, request: GetGroupInput, **kwargs: Any
    ) -> ServiceResult[GroupResponse]:
        try:
            output = await self.repo.provide(request)
            if output.group is None:
                return ServiceResult.fail("Group not found")
            return ServiceResult.ok(GroupResponse.model_validate(output.group))
        except Exception as e:
            return ServiceResult.fail(str(e))


class UpdateGroupService(BaseService[UpdateGroupInput, GroupResponse]):
    """정산 그룹 부분 수정"""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db)
        self.repo = UpdateGroupRepository(db)

    async def execute(
        self, request: UpdateGroupInput, **kwargs: Any
    ) -> ServiceResult[GroupResponse]:
        try:
            output = await self.repo.provide(request)
            return ServiceResult.ok(GroupResponse.model_validate(output.group))
        except ValueError as e:
            return ServiceResult.fail(str(e))
        except Exception as e:
            return ServiceResult.fail(str(e))


class VerifyPasswordService(BaseService[VerifyPasswordRequest, bool]):
    """잠긴 그룹의 비밀번호 검증"""

    def __init__(self, db: AsyncSession, group_id: UUID) -> None:
        super().__init__(db)
        self.group_id = group_id
        self.repo = GetGroupRepository(db)

    async def execute(
        self, request: VerifyPasswordRequest, **kwargs: Any
    ) -> ServiceResult[bool]:
        try:
            output = await self.repo.provide(GetGroupInput(group_id=self.group_id))
            if output.group is None:
                return ServiceResult.fail("Group not found")
            if not output.group.is_locked or not output.group.password_hash:
                return ServiceResult.ok(True)
            verified = _pwd_ctx.verify(request.password, output.group.password_hash)
            return ServiceResult.ok(verified)
        except Exception as e:
            return ServiceResult.fail(str(e))


class PollGroupService(BaseService[GetGroupInput, PollResponse]):
    """updated_at 만 반환 — 클라이언트 폴링용"""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db)
        self.repo = GetGroupRepository(db)

    async def execute(
        self, request: GetGroupInput, **kwargs: Any
    ) -> ServiceResult[PollResponse]:
        try:
            output = await self.repo.provide(request)
            if output.group is None:
                return ServiceResult.fail("Group not found")
            return ServiceResult.ok(PollResponse(updated_at=output.group.updated_at))
        except Exception as e:
            return ServiceResult.fail(str(e))

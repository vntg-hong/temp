"""
DutchPay 도메인 Repository

DB CRUD 작업을 담당합니다.
"""

from sqlalchemy import select

from server.app.shared.base import BaseRepository
from server.app.domain.dutchpay.models import SettlementGroup
from server.app.domain.dutchpay.schemas import (
    CreateGroupInput,
    CreateGroupOutput,
    GetGroupInput,
    GetGroupOutput,
    UpdateGroupInput,
    UpdateGroupOutput,
)


class CreateGroupRepository(BaseRepository[CreateGroupInput, CreateGroupOutput]):
    """신규 정산 그룹 생성"""

    async def provide(self, input_data: CreateGroupInput) -> CreateGroupOutput:
        group = SettlementGroup(
            title=input_data.title,
            budget=input_data.budget,
            members=input_data.members,
            expenses=input_data.expenses,
            completed_settlements=input_data.completed_settlements,
            is_locked=input_data.is_locked,
            password_hash=input_data.password_hash,
        )
        self.db.add(group)
        await self.db.commit()
        await self.db.refresh(group)
        return CreateGroupOutput(group=group)


class GetGroupRepository(BaseRepository[GetGroupInput, GetGroupOutput]):
    """UUID로 정산 그룹 조회"""

    async def provide(self, input_data: GetGroupInput) -> GetGroupOutput:
        result = await self.db.execute(
            select(SettlementGroup).where(SettlementGroup.id == input_data.group_id)
        )
        group = result.scalar_one_or_none()
        return GetGroupOutput(group=group)


class UpdateGroupRepository(BaseRepository[UpdateGroupInput, UpdateGroupOutput]):
    """정산 그룹 부분 수정"""

    async def provide(self, input_data: UpdateGroupInput) -> UpdateGroupOutput:
        result = await self.db.execute(
            select(SettlementGroup).where(SettlementGroup.id == input_data.group_id)
        )
        group = result.scalar_one_or_none()
        if group is None:
            raise ValueError("Group not found")

        for key, value in input_data.updates.items():
            setattr(group, key, value)

        await self.db.commit()
        await self.db.refresh(group)
        return UpdateGroupOutput(group=group)

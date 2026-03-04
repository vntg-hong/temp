"""
DutchPay API 엔드포인트

POST   /dutchpay               — 정산방 생성
GET    /dutchpay/{group_id}    — 정산방 조회
PATCH  /dutchpay/{group_id}    — 정산방 수정
POST   /dutchpay/{group_id}/verify — 비밀번호 검증
GET    /dutchpay/{group_id}/poll   — 변경 감지 (updated_at)
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.core.database import get_db
from server.app.domain.dutchpay.schemas import (
    CreateGroupRequest,
    GroupResponse,
    GetGroupInput,
    PollResponse,
    UpdateGroupInput,
    UpdateGroupRequest,
    VerifyPasswordRequest,
)
from server.app.domain.dutchpay.service import (
    CreateGroupService,
    GetGroupService,
    PollGroupService,
    UpdateGroupService,
    VerifyPasswordService,
)

router = APIRouter(prefix="/dutchpay", tags=["dutchpay"])


@router.post("", response_model=GroupResponse, status_code=201)
async def create_group(
    body: CreateGroupRequest,
    db: AsyncSession = Depends(get_db),
) -> GroupResponse:
    """공유 정산방 생성 — UUID를 반환합니다."""
    result = await CreateGroupService(db).execute(body)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result.data  # type: ignore[return-value]


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> GroupResponse:
    """UUID로 정산방 조회. 잠금 여부와 관계없이 메타데이터를 반환합니다."""
    result = await GetGroupService(db).execute(GetGroupInput(group_id=group_id))
    if not result.success:
        raise HTTPException(status_code=404, detail=result.error)
    return result.data  # type: ignore[return-value]


@router.patch("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: UUID,
    body: UpdateGroupRequest,
    db: AsyncSession = Depends(get_db),
) -> GroupResponse:
    """정산방 데이터 부분 수정. 전달된 필드만 갱신합니다."""
    updates: dict = {}

    if body.title is not None:
        updates["title"] = body.title
    if body.budget is not None:
        updates["budget"] = body.budget
    if body.members is not None:
        updates["members"] = body.members
    if body.expenses is not None:
        updates["expenses"] = body.expenses
    if body.completed_settlements is not None:
        updates["completed_settlements"] = body.completed_settlements
    if body.is_locked is not None:
        updates["is_locked"] = body.is_locked
    if body.password is not None:
        from passlib.context import CryptContext

        ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        updates["password_hash"] = ctx.hash(body.password) if body.password else None

    if not updates:
        result = await GetGroupService(db).execute(GetGroupInput(group_id=group_id))
    else:
        result = await UpdateGroupService(db).execute(
            UpdateGroupInput(group_id=group_id, updates=updates)
        )

    if not result.success:
        raise HTTPException(status_code=404, detail=result.error)
    return result.data  # type: ignore[return-value]


@router.post("/{group_id}/verify")
async def verify_password(
    group_id: UUID,
    body: VerifyPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """잠긴 정산방의 비밀번호를 검증합니다."""
    result = await VerifyPasswordService(db, group_id).execute(body)
    if not result.success:
        raise HTTPException(status_code=404, detail=result.error)
    if not result.data:
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다")
    return {"verified": True}


@router.get("/{group_id}/poll", response_model=PollResponse)
async def poll_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> PollResponse:
    """실시간 동기화용 폴링 — updated_at 만 반환합니다."""
    result = await PollGroupService(db).execute(GetGroupInput(group_id=group_id))
    if not result.success:
        raise HTTPException(status_code=404, detail=result.error)
    return result.data  # type: ignore[return-value]

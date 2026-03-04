"""create settlement_groups

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-03-04 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. settlement_groups 테이블 생성
    op.create_table(
        "settlement_groups",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            comment="공유 URL 식별자 (UUID v4)",
        ),
        sa.Column(
            "title",
            sa.Text(),
            nullable=False,
            server_default="정산",
            comment="정산방 제목",
        ),
        sa.Column(
            "budget",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="초기 예산 (KRW)",
        ),
        sa.Column(
            "members",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="'[]'::jsonb",
            comment="참여자 목록 [{id, name}]",
        ),
        sa.Column(
            "expenses",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="'[]'::jsonb",
            comment="지출 내역 목록",
        ),
        sa.Column(
            "completed_settlements",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="'[]'::jsonb",
            comment="완료 처리된 정산 키 목록",
        ),
        sa.Column(
            "is_locked",
            sa.Boolean(),
            nullable=False,
            server_default="false",
            comment="비밀번호 잠금 여부",
        ),
        sa.Column(
            "password_hash",
            sa.Text(),
            nullable=True,
            comment="bcrypt 해시 비밀번호 (NULL = 잠금 없음)",
        ),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMPTZ(),
            nullable=False,
            server_default=sa.text("now()"),
            comment="생성 일시",
        ),
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMPTZ(),
            nullable=False,
            server_default=sa.text("now()"),
            comment="최종 수정 일시 (폴링 기준)",
        ),
        sa.Column(
            "expires_at",
            postgresql.TIMESTAMPTZ(),
            nullable=True,
            comment="만료 일시 (NULL = 영구 보관)",
        ),
    )

    # 2. updated_at 자동 갱신 트리거 함수
    op.execute("""
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trg_settlement_groups_updated_at
            BEFORE UPDATE ON settlement_groups
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    """)

    # 3. 인덱스
    op.create_index(
        "idx_sg_created_at",
        "settlement_groups",
        ["created_at"],
        postgresql_ops={"created_at": "DESC"},
    )
    op.create_index(
        "idx_sg_expires_at",
        "settlement_groups",
        ["expires_at"],
        postgresql_where=sa.text("expires_at IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_sg_expires_at", table_name="settlement_groups")
    op.drop_index("idx_sg_created_at", table_name="settlement_groups")
    op.execute("DROP TRIGGER IF EXISTS trg_settlement_groups_updated_at ON settlement_groups;")
    op.execute("DROP FUNCTION IF EXISTS set_updated_at;")
    op.drop_table("settlement_groups")

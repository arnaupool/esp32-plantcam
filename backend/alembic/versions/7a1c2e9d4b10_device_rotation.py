"""rotación por dispositivo

Revision ID: 7a1c2e9d4b10
Revises: 56367dce33fc
Create Date: 2026-10-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "7a1c2e9d4b10"
down_revision: Union[str, None] = "56367dce33fc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("devices", sa.Column("rotation", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    with op.batch_alter_table("devices") as batch:
        batch.drop_column("rotation")

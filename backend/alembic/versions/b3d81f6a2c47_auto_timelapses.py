"""timelapses automáticos por dispositivo

Revision ID: b3d81f6a2c47
Revises: 7a1c2e9d4b10
Create Date: 2026-10-30

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b3d81f6a2c47"
down_revision: Union[str, None] = "7a1c2e9d4b10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("devices", sa.Column("auto_daily_timelapse", sa.Boolean(), nullable=False, server_default="1"))
    op.add_column("devices", sa.Column("auto_weekly_timelapse", sa.Boolean(), nullable=False, server_default="1"))


def downgrade() -> None:
    with op.batch_alter_table("devices") as batch:
        batch.drop_column("auto_weekly_timelapse")
        batch.drop_column("auto_daily_timelapse")

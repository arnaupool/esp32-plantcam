"""retención por dispositivo: null pasa a significar no borrar nunca

Revision ID: c5e2a9b7d013
Revises: b3d81f6a2c47
Create Date: 2026-10-31

"""
from typing import Sequence, Union

from alembic import op

revision: str = "c5e2a9b7d013"
down_revision: Union[str, None] = "b3d81f6a2c47"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Hasta ahora null era "usa el valor global" (14 días); se conserva ese plazo en los dispositivos existentes.
    op.execute("UPDATE devices SET retention_days = 14 WHERE retention_days IS NULL")


def downgrade() -> None:
    pass

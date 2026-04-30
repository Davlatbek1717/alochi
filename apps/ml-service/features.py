"""Feature schema validation and preprocessing."""
from pydantic import BaseModel, Field


FEATURE_COLUMNS = [
    "absent_days_30d",
    "streak_value",
    "lessons_completed_30d",
    "lessons_failed_30d",
    "has_red_status",
    "has_parent_tg",
    "pass_rate_30d",
]


class Features(BaseModel):
    absent_days_30d: int = Field(ge=0)
    streak_value: int = Field(ge=0)
    lessons_completed_30d: int = Field(ge=0)
    lessons_failed_30d: int = Field(ge=0)
    has_red_status: int = Field(ge=0, le=1)
    has_parent_tg: int = Field(ge=0, le=1)
    pass_rate_30d: float = Field(ge=0, le=100)

    def to_vector(self) -> list:
        return [getattr(self, col) for col in FEATURE_COLUMNS]

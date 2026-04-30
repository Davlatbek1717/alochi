"""Feature schema validation and preprocessing."""
from pydantic import BaseModel, Field


# Order matters: when extending, append at the end so the saved/loaded
# model's coefficient vector keeps aligning with the index of each feature.
FEATURE_COLUMNS = [
    "absent_days_30d",
    "streak_value",
    "lessons_completed_30d",
    "lessons_failed_30d",
    "has_red_status",
    "has_parent_tg",
    "pass_rate_30d",
    # Phase 14 — 9-feature set
    "pass_rate_change",
    "avg_session_count",
    "xp_gained_7d",
]


class Features(BaseModel):
    absent_days_30d: int = Field(ge=0)
    streak_value: int = Field(ge=0)
    lessons_completed_30d: int = Field(ge=0)
    lessons_failed_30d: int = Field(ge=0)
    has_red_status: int = Field(ge=0, le=1)
    has_parent_tg: int = Field(ge=0, le=1)
    pass_rate_30d: float = Field(ge=0, le=100)
    # Phase 14: signed delta — this week's pass rate minus last week's pass rate.
    # Negative values mean the student is regressing.
    pass_rate_change: float = Field(ge=-100, le=100, default=0.0)
    # Mean StudentProgress.sessionCount over the 30-day window.
    avg_session_count: float = Field(ge=0, default=0.0)
    # Sum of XpEvent.amount in last 7 days.
    xp_gained_7d: int = Field(ge=0, default=0)

    def to_vector(self) -> list:
        return [getattr(self, col) for col in FEATURE_COLUMNS]

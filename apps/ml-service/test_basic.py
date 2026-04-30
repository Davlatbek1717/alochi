"""Basic unit tests."""
import os
import tempfile
import pytest
from features import Features, FEATURE_COLUMNS


def test_feature_to_vector():
    f = Features(
        absent_days_30d=3,
        streak_value=5,
        lessons_completed_30d=10,
        lessons_failed_30d=2,
        has_red_status=0,
        has_parent_tg=1,
        pass_rate_30d=83.33,
    )
    v = f.to_vector()
    assert len(v) == len(FEATURE_COLUMNS)
    assert v[0] == 3
    assert v[6] == 83.33


def test_feature_validation():
    with pytest.raises(Exception):
        Features(
            absent_days_30d=-1,  # invalid
            streak_value=0,
            lessons_completed_30d=0,
            lessons_failed_30d=0,
            has_red_status=0,
            has_parent_tg=0,
            pass_rate_30d=0,
        )


def test_model_save_load(tmp_path, monkeypatch):
    from sklearn.ensemble import GradientBoostingClassifier
    import joblib
    monkeypatch.setenv("MODEL_PATH", str(tmp_path / "model.pkl"))
    from model_store import save_model, load_model

    # Train tiny model
    model = GradientBoostingClassifier(n_estimators=5, random_state=42)
    X = [[i] * 7 for i in range(10)]
    y = [i % 2 for i in range(10)]
    model.fit(X, y)

    version = save_model(model, {"accuracy": 0.5})
    assert version

    loaded, metrics = load_model()
    assert loaded is not None
    assert metrics["accuracy"] == 0.5

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
        pass_rate_change=-5.5,
        avg_session_count=1.4,
        xp_gained_7d=120,
    )
    v = f.to_vector()
    assert len(v) == len(FEATURE_COLUMNS) == 10
    assert v[0] == 3
    assert v[6] == 83.33
    # Phase 14 trailing block: pass_rate_change, avg_session_count, xp_gained_7d
    assert v[-3] == -5.5
    assert v[-2] == 1.4
    assert v[-1] == 120


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

    # Train tiny model — uses dynamic FEATURE_COLUMNS length so the test
    # automatically tracks Phase-14 expansion to 9 features.
    model = GradientBoostingClassifier(n_estimators=5, random_state=42)
    n = len(FEATURE_COLUMNS)
    X = [[i] * n for i in range(10)]
    y = [i % 2 for i in range(10)]
    model.fit(X, y)

    version = save_model(model, {"accuracy": 0.5})
    assert version

    loaded, metrics = load_model()
    assert loaded is not None
    assert metrics["accuracy"] == 0.5


def test_prediction_shape():
    """Phase 14: train_model returns a model that predicts with shape (1, 2)
    and metrics include cv_folds=5 and the requested sample count."""
    from train import train_model
    import numpy as np

    rng = np.random.RandomState(42)
    n_samples = 150
    X = rng.rand(n_samples, len(FEATURE_COLUMNS))
    # Two-class label, ~30% positive — guarantees both classes appear in every
    # stratified fold (5-fold needs >= 5 positives and >= 5 negatives).
    y = (rng.rand(n_samples) > 0.7).astype(int)

    model, metrics = train_model(X, y)

    # Single-sample prediction should yield (1, 2) probabilities.
    sample = rng.rand(len(FEATURE_COLUMNS))
    pred = model.predict_proba([sample])

    assert pred.shape == (1, 2), f"Expected (1, 2), got {pred.shape}"
    p1 = float(pred[0][1])
    assert 0.0 <= p1 <= 1.0, f"Probability {p1} out of [0, 1]"

    # Metrics contract for /metrics endpoint + frontend block.
    assert metrics["samples"] == n_samples
    assert metrics["cv_folds"] == 5
    for key in (
        "precision_mean",
        "precision_std",
        "recall_mean",
        "recall_std",
        "f1_mean",
        "f1_std",
        "trained_at",
    ):
        assert key in metrics, f"missing metric: {key}"


def test_train_model_cold_start_guard():
    """train_model must reject < 100 samples with a cold_start error."""
    from train import train_model
    import numpy as np

    rng = np.random.RandomState(0)
    X = rng.rand(50, len(FEATURE_COLUMNS))
    y = (rng.rand(50) > 0.5).astype(int)
    with pytest.raises(ValueError, match="cold_start"):
        train_model(X, y)


if __name__ == "__main__":
    # Allow `python apps/ml-service/test_basic.py` if pytest is unavailable.
    raise SystemExit(pytest.main([__file__, "-q"]))

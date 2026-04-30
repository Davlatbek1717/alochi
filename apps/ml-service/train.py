"""Train churn prediction model from PostgreSQL data."""
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import precision_score, recall_score, f1_score

from db import fetch_training_data
from features import FEATURE_COLUMNS
from model_store import save_model

logger = logging.getLogger(__name__)


def train_model(X: np.ndarray, y: np.ndarray) -> Tuple[GradientBoostingClassifier, Dict[str, Any]]:
    """Train a GradientBoostingClassifier with stratified 5-fold cross-validation.

    Returns (final_model, metrics). The final model is fit on the FULL data set
    after CV; CV is only used to estimate generalisation error (mean +/- std).

    Raises:
      ValueError if `len(X) < 100` (cold start) or only one class is present.
    """
    n = len(X)
    if n < 100:
        raise ValueError(
            f"cold_start: need at least 100 samples, got {n}",
        )

    X_arr = np.asarray(X, dtype=float)
    y_arr = np.asarray(y, dtype=int)

    if len(np.unique(y_arr)) < 2:
        raise ValueError(
            "Training data has only one class — need both churned and active samples",
        )

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    p_scores, r_scores, f_scores = [], [], []
    for train_idx, test_idx in skf.split(X_arr, y_arr):
        m = GradientBoostingClassifier(n_estimators=100, max_depth=4, random_state=42)
        m.fit(X_arr[train_idx], y_arr[train_idx])
        pred = m.predict(X_arr[test_idx])
        p_scores.append(precision_score(y_arr[test_idx], pred, zero_division=0))
        r_scores.append(recall_score(y_arr[test_idx], pred, zero_division=0))
        f_scores.append(f1_score(y_arr[test_idx], pred, zero_division=0))

    final = GradientBoostingClassifier(n_estimators=100, max_depth=4, random_state=42)
    final.fit(X_arr, y_arr)

    metrics: Dict[str, Any] = {
        "samples": int(n),
        "precision_mean": float(np.mean(p_scores)),
        "precision_std": float(np.std(p_scores)),
        "recall_mean": float(np.mean(r_scores)),
        "recall_std": float(np.std(r_scores)),
        "f1_mean": float(np.mean(f_scores)),
        "f1_std": float(np.std(f_scores)),
        "cv_folds": 5,
        "trained_at": datetime.utcnow().isoformat(),
        "featureColumns": list(FEATURE_COLUMNS),
    }
    return final, metrics


async def train() -> Dict[str, Any]:
    rows = await fetch_training_data()
    if len(rows) < 100:
        raise ValueError(f"Insufficient training data: {len(rows)} samples (need 100+)")

    df = pd.DataFrame(rows)
    df = df.dropna(subset=["churned"])
    if len(df) < 100:
        raise ValueError(f"Insufficient labeled data: {len(df)} samples after dropna")

    X = df[FEATURE_COLUMNS].astype(float).to_numpy()
    y = df["churned"].astype(int).to_numpy()

    model, metrics = train_model(X, y)

    version = save_model(model, metrics)
    logger.info(
        f"Model trained: version={version} "
        f"f1_mean={metrics['f1_mean']:.3f} +/- {metrics['f1_std']:.3f}"
    )
    return metrics

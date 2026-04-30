"""Train churn prediction model from PostgreSQL data."""
import asyncio
import logging
from typing import Dict, Any
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_score, recall_score, f1_score, accuracy_score

from db import fetch_training_data
from features import FEATURE_COLUMNS
from model_store import save_model

logger = logging.getLogger(__name__)


async def train() -> Dict[str, Any]:
    rows = await fetch_training_data()
    if len(rows) < 100:
        raise ValueError(f"Insufficient training data: {len(rows)} samples (need 100+)")

    df = pd.DataFrame(rows)
    df = df.dropna(subset=["churned"])
    if len(df) < 100:
        raise ValueError(f"Insufficient labeled data: {len(df)} samples after dropna")

    X = df[FEATURE_COLUMNS].astype(float)
    y = df["churned"].astype(int)

    if y.nunique() < 2:
        raise ValueError("Training data has only one class — need both churned and active samples")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    model = GradientBoostingClassifier(
        n_estimators=100, max_depth=4, random_state=42
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    metrics = {
        "samples": len(df),
        "trainSamples": len(X_train),
        "testSamples": len(X_test),
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "featureColumns": FEATURE_COLUMNS,
    }

    version = save_model(model, metrics)
    logger.info(f"Model trained: version={version} accuracy={metrics['accuracy']:.3f}")
    return metrics

"""Load/save sklearn model with versioning."""
import os
import json
from datetime import datetime
from pathlib import Path
import joblib
from typing import Optional, Tuple, Dict, Any


def model_path() -> Path:
    return Path(os.environ.get("MODEL_PATH", "/app/models/churn_model.pkl"))


def metrics_path() -> Path:
    return model_path().with_suffix(".metrics.json")


def save_model(model, metrics: Dict[str, Any]) -> str:
    model_path().parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_path())
    metrics["trainedAt"] = datetime.utcnow().isoformat() + "Z"
    metrics["modelVersion"] = metrics["trainedAt"]
    with metrics_path().open("w") as f:
        json.dump(metrics, f, indent=2)
    return metrics["modelVersion"]


def load_model() -> Tuple[Optional[Any], Optional[Dict[str, Any]]]:
    if not model_path().exists():
        return None, None
    model = joblib.load(model_path())
    if metrics_path().exists():
        with metrics_path().open() as f:
            metrics = json.load(f)
    else:
        metrics = {}
    return model, metrics

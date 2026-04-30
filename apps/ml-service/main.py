"""FastAPI app: /train, /predict, /health, /metrics."""
import logging
from typing import Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from features import Features
from model_store import load_model
from train import train

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Alochi ML Churn Service")


class PredictRequest(BaseModel):
    features: Features


class PredictResponse(BaseModel):
    probability: float
    score: int
    modelVersion: Optional[str] = None


@app.get("/health")
def health():
    model, metrics = load_model()
    return {
        "status": "ok",
        "modelLoaded": model is not None,
        "modelVersion": (metrics or {}).get("modelVersion"),
    }


@app.get("/metrics")
def get_metrics():
    _, metrics = load_model()
    if not metrics:
        raise HTTPException(status_code=404, detail="No metrics available — model not yet trained")
    return metrics


@app.post("/train")
async def trigger_train():
    try:
        metrics = await train()
        return metrics
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Training failed")
        raise HTTPException(status_code=500, detail=f"Training failed: {e}")


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    model, metrics = load_model()
    if not model:
        raise HTTPException(status_code=503, detail="Model not loaded — call /train first")

    vector = [req.features.to_vector()]
    proba = model.predict_proba(vector)[0]
    # proba[1] is probability of churn (positive class)
    p = float(proba[1]) if len(proba) > 1 else 0.0
    return PredictResponse(
        probability=p,
        score=int(round(p * 100)),
        modelVersion=(metrics or {}).get("modelVersion"),
    )

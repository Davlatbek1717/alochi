import sys
import numpy as np
import pytest
from unittest.mock import MagicMock


def test_cosine_similarity():
    sys.modules['face_recognition'] = MagicMock()

    # Force reimport in case module was cached without the mock
    if 'services.face_service' in sys.modules:
        del sys.modules['services.face_service']

    from services.face_service import cosine_similarity

    v1 = np.array([1.0, 0.0, 0.0])
    v2 = np.array([1.0, 0.0, 0.0])
    v3 = np.array([0.0, 1.0, 0.0])

    assert cosine_similarity(v1, v2) == pytest.approx(1.0)
    assert cosine_similarity(v1, v3) == pytest.approx(0.0)


def test_recognition_threshold():
    sys.modules['face_recognition'] = MagicMock()

    if 'services.face_service' in sys.modules:
        del sys.modules['services.face_service']

    from services.face_service import RECOGNITION_THRESHOLD

    assert RECOGNITION_THRESHOLD == 0.80

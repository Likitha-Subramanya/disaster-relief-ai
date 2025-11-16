from dataclasses import dataclass
from typing import Optional


@dataclass
class ClassificationResult:
    category: str
    urgency: str


@dataclass
class ExtractionResult:
    injured_count: Optional[int]
    trapped: Optional[bool]
    water_level_m: Optional[float]


def classify_text(text: str) -> ClassificationResult:
    """Very simple rule-based classifier stub.

    In production, replace with a real ML model (e.g. transformer hosted service or local model).
    """
    text_lower = text.lower()

    if any(k in text_lower for k in ["heart attack", "unconscious", "severe bleeding", "not breathing"]):
        category = "medical"
        urgency = "critical"
    elif any(k in text_lower for k in ["fire", "building collapse", "trapped"]):
        category = "rescue"
        urgency = "critical"
    elif any(k in text_lower for k in ["flood", "water rising", "water level"]):
        category = "flood"
        urgency = "urgent"
    elif any(k in text_lower for k in ["no food", "no water", "supplies"]):
        category = "supplies"
        urgency = "urgent"
    else:
        category = "other"
        urgency = "low"

    return ClassificationResult(category=category, urgency=urgency)


def extract_structured(text: str) -> ExtractionResult:
    """Rule-based extractor stub.

    Looks for simple patterns like "X injured", "Y trapped", "water Zm".
    Replace with a real IE model in production.
    """
    import re

    text_lower = text.lower()

    injured = None
    m_inj = re.search(r"(\d+)\s+injured", text_lower)
    if m_inj:
        injured = int(m_inj.group(1))

    trapped = None
    if "trapped" in text_lower:
        trapped = True

    water_level = None
    m_water = re.search(r"water\s+(\d+(?:\.\d+)?)m", text_lower)
    if m_water:
        water_level = float(m_water.group(1))

    return ExtractionResult(
        injured_count=injured,
        trapped=trapped,
        water_level_m=water_level,
    )

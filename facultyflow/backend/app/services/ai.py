"""AI drafting. The AI only drafts; the teacher approves.

Advisory tiers (attendance-based):
  < 50%  → URGENT  : exam-eligibility risk, strong immediate action
  50-74% → CRITICAL: below requirement, serious concern
  75-85% → ADVISORY: borderline, needs care
  > 85%  → POSITIVE: good attendance, encourage marks improvement
"""
import re

import httpx

from .. import config
from .analytics import fmt

ISSUE_LABEL = {"attendance": "attendance shortage", "marks": "low internal marks"}


# ── Attendance tier helpers ──────────────────────────────────────────────────

def attendance_tier(attendance):
    """Return the advisory tier label based on current attendance %."""
    if attendance is None:
        return "unknown"
    if attendance < 50:
        return "urgent"      # exam eligibility at risk
    if attendance < 75:
        return "critical"    # below institute requirement
    if attendance <= 85:
        return "advisory"    # borderline
    return "positive"       # good attendance


TIER_INSTRUCTIONS = {
    "urgent": (
        "URGENT NOTICE. The student's attendance is critically low (below 50%). "
        "They are at risk of becoming ineligible to appear in semester examinations. "
        "The tone must be firm yet caring. Clearly state the exam-eligibility risk. "
        "Ask them to meet you immediately. Do not sugarcoat."
    ),
    "critical": (
        "SERIOUS CONCERN. The student's attendance is below the institute's 75% minimum requirement. "
        "They need to improve urgently to avoid academic consequences. "
        "Be direct but supportive. Mention the specific risk. Suggest a plan to recover."
    ),
    "advisory": (
        "ADVISORY NOTICE. The student is in the borderline range (75-85%). "
        "Be gentle but clear that they should not miss any more classes. "
        "Encourage them and suggest staying consistent."
    ),
    "positive": (
        "POSITIVE ENCOURAGEMENT. The student has good attendance (above 85%). "
        "Acknowledge their attendance effort. Focus this message on improving their internal marks. "
        "Be warm, motivating and constructive."
    ),
    "unknown": (
        "Be supportive and ask the student to maintain good attendance and study habits."
    ),
}

PROMPT_TEMPLATE = """You are an academic support assistant for a college.
Write a polite, confidential message to a student.
Student name: {name}
Course: {course}
Attendance percentage: {attendance}
CIE percentage: {cie}
Issue: {issue}
Tone instruction: {tone}
Rules:
- Do not blame the student.
- Be respectful and specific.
- Suggest practical next steps.
- Keep it under 120 words.
- Do not invent marks or attendance data."""


def first_name(full: str) -> str:
    parts = (full or "").split()
    return parts[0] if parts else "Student"


def build_prompt(name, course, attendance, cie, issue_type):
    """Data minimisation: only first name, course, two numbers and the issue."""
    tier = attendance_tier(attendance)
    tone = TIER_INSTRUCTIONS[tier]
    return PROMPT_TEMPLATE.format(
        name=first_name(name),
        course=course,
        attendance=fmt(attendance) + ("%" if attendance is not None else ""),
        cie=fmt(cie) + ("%" if cie is not None else ""),
        issue=ISSUE_LABEL[issue_type],
        tone=tone,
    )


# ── Tiered template drafts (fallback when AI unavailable) ───────────────────

def template_draft(name, course, attendance, cie, issue_type):
    n = first_name(name)
    tier = attendance_tier(attendance)

    if issue_type == "attendance":
        if tier == "urgent":
            return (
                f"Dear {n},\n\n"
                f"This is an urgent notice regarding your attendance in {course}. "
                f"Your current attendance stands at {fmt(attendance)}%, which is below 50%. "
                f"You are now at risk of being declared ineligible to appear in the semester examinations. "
                f"I strongly urge you to meet me immediately to discuss a recovery plan. "
                f"Please do not miss any further classes.\n\n"
                f"This requires your immediate attention.\n\nRegards"
            )
        if tier == "critical":
            return (
                f"Dear {n},\n\n"
                f"I want to bring to your attention that your attendance in {course} is {fmt(attendance)}%, "
                f"which is below the institute's minimum requirement of 75%. "
                f"If this continues, you may face serious academic consequences. "
                f"I encourage you to attend every remaining class and meet me to discuss how I can support you.\n\n"
                f"Let's work together to get you back on track.\n\nRegards"
            )
        if tier == "advisory":
            return (
                f"Dear {n},\n\n"
                f"Your attendance in {course} is currently {fmt(attendance)}%, which is in the advisory range. "
                f"You are not far from the required 75%, but please be careful not to miss any more classes. "
                f"Consistency now will help you avoid any issues later in the semester. "
                f"Feel free to reach out if you need any support.\n\n"
                f"Keep it up!\n\nRegards"
            )
        # positive tier — attendance is fine, so this is a general nudge
        return (
            f"Dear {n},\n\n"
            f"Great work maintaining your attendance in {course} at {fmt(attendance)}%! "
            f"I encourage you to keep this up for the rest of the semester. "
            f"If you have any concerns or need guidance, please do not hesitate to reach out.\n\n"
            f"Keep up the excellent effort!\n\nRegards"
        )

    # marks issue
    if tier in ("urgent", "critical"):
        return (
            f"Dear {n},\n\n"
            f"I am writing regarding your performance in {course}. "
            f"Your internal marks (CIE) stand at {fmt(cie)}%, which is a concern. "
            f"Given that your attendance is also low at {fmt(attendance)}%, "
            f"it is important to address both urgently. "
            f"Please meet me to discuss a study plan and additional support.\n\n"
            f"I am here to help you succeed.\n\nRegards"
        )
    return (
        f"Dear {n},\n\n"
        f"Thank you for your effort in {course}. Your internal marks are at {fmt(cie)}% so far, "
        f"and I believe with focused revision you can improve significantly. "
        f"I suggest revisiting key topics from recent assessments and attending any doubt-clearing sessions. "
        f"Please reach out if you need guidance.\n\n"
        f"I am confident you can do better!\n\nRegards"
    )


# ── Provider call ────────────────────────────────────────────────────────────

def _call_provider(prompt: str) -> str:
    p = config.AI_PROVIDER
    t = config.AI_TIMEOUT
    if p == "gemini":
        url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
               f"{config.GEMINI_MODEL}:generateContent")
        r = httpx.post(url, params={"key": config.GEMINI_API_KEY}, timeout=t,
                       json={"contents": [{"parts": [{"text": prompt}]}]})
        r.raise_for_status()
        return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    if p == "openai":
        r = httpx.post("https://api.openai.com/v1/chat/completions", timeout=t,
                       headers={"Authorization": f"Bearer {config.OPENAI_API_KEY}"},
                       json={"model": config.OPENAI_MODEL,
                             "messages": [{"role": "user", "content": prompt}]})
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()
    if p == "ollama":
        r = httpx.post(f"{config.OLLAMA_URL}/api/generate", timeout=max(t, 60),
                       json={"model": config.OLLAMA_MODEL, "prompt": prompt, "stream": False})
        r.raise_for_status()
        return r.json()["response"].strip()
    raise ValueError("mock")


def check_draft(text, attendance, cie):
    """Fact-check: flag word count and any % that does not match the dashboard."""
    warnings = []
    words = len(text.split())
    if words > 120:
        warnings.append(f"Draft is {words} words (limit 120). Please shorten it.")
    allowed = [x for x in (attendance, cie) if x is not None]
    for m in re.findall(r"(\d+(?:\.\d+)?)\s*%", text):
        if not any(abs(float(m) - a) < 0.06 for a in allowed):
            warnings.append(f"Draft mentions {m}%, which does not match the dashboard numbers.")
    return warnings


def generate_draft(name, course, attendance, cie, issue_type):
    prompt = build_prompt(name, course, attendance, cie, issue_type)
    provider = config.AI_PROVIDER
    tier = attendance_tier(attendance)
    try:
        if provider == "mock":
            raise ValueError("mock")
        text = _call_provider(prompt)
        if not text:
            raise ValueError("empty response")
    except Exception as exc:
        text = template_draft(name, course, attendance, cie, issue_type)
        provider = "template" if str(exc) == "mock" else "template (AI unavailable)"
    return {
        "draft": text,
        "provider": provider,
        "tier": tier,
        "warnings": check_draft(text, attendance, cie),
    }

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
    # Deterministic variation based on student name and course for distinct, unique drafts
    seed = (sum(ord(c) for c in (name + course)) % 3)

    if issue_type == "attendance":
        if tier == "urgent":
            openings = [
                f"Dear {n},\n\nI am reaching out with an urgent note regarding your attendance in {course}. Your recorded attendance is currently {fmt(attendance)}%, which places your semester examination eligibility at critical risk.",
                f"Dear {n},\n\nThis is an urgent academic notification concerning your presence in {course}. Standing at {fmt(attendance)}%, your attendance is well below the minimum threshold required to sit for final exams.",
                f"Dear {n},\n\nI want to urgently draw your attention to your attendance standing in {course}. At {fmt(attendance)}%, you are in immediate danger of falling short of university exam eligibility criteria.",
            ]
            actions = [
                "Please connect with me during office hours this week so we can review your situation and map out an emergency recovery schedule. Every upcoming lecture counts.",
                "I strongly encourage you to meet me right away so we can coordinate on missed material and keep you enrolled in good standing. Prioritize attending all remaining sessions.",
                "Let us schedule an immediate conversation to discuss your circumstances and set up a plan to attend all remaining classes without further absence.",
            ]
            return f"{openings[seed]}\n\n{actions[seed]}\n\nBest regards,\nYour Faculty Advisor"

        if tier == "critical":
            openings = [
                f"Dear {n},\n\nI am writing to share an important concern regarding your attendance in {course}. You are currently at {fmt(attendance)}%, which is below the mandatory 75% institute threshold.",
                f"Dear {n},\n\nYour attendance in {course} has reached {fmt(attendance)}%, placing you below the 75% course requirement. Consistent presence is essential for your academic progress.",
                f"Dear {n},\n\nI noticed that your attendance in {course} is currently at {fmt(attendance)}%. Falling beneath the 75% mark puts your academic semester standing at risk.",
            ]
            actions = [
                "With disciplined attendance across our remaining classes, you can steadily climb back into the safe zone. Please let me know if you need any support.",
                "I encourage you to attend every upcoming class without exception. Feel free to stop by if there are personal or academic hurdles you would like to discuss.",
                "Focus on attending all upcoming lectures consecutively to recover your eligibility. I am here to help you stay on track.",
            ]
            return f"{openings[seed]}\n\n{actions[seed]}\n\nWarm regards,\nCourse Instructor"

        if tier == "advisory":
            openings = [
                f"Dear {n},\n\nYour attendance in {course} currently stands at {fmt(attendance)}%. While you are within the advisory range, you are close to the 75% boundary.",
                f"Dear {n},\n\nI wanted to share a friendly advisory that your attendance in {course} is {fmt(attendance)}%. You are near the 75% cutoff, so consistent vigilance will protect your standing.",
                f"Dear {n},\n\nChecking in on your progress in {course}—your current attendance is {fmt(attendance)}%. Maintaining steady attendance from here will prevent any last-minute shortages.",
            ]
            actions = [
                "Staying regular for the rest of the term will comfortably keep you in the safe zone. Keep up the momentum!",
                "Try to avoid any unnecessary absences over the coming weeks so you finish the semester stress-free. Reach out if you need anything.",
                "A little extra consistency now will ensure you remain safely above the threshold. Best of luck with your coursework!",
            ]
            return f"{openings[seed]}\n\n{actions[seed]}\n\nBest regards,\nFaculty Mentor"

        # positive tier
        return (
            f"Dear {n},\n\n"
            f"Commendable job maintaining strong attendance in {course} at {fmt(attendance)}%! "
            f"Your regular participation sets a positive foundation for the semester. "
            f"Continue this dedicated effort and feel free to reach out if you ever need extra academic resources.\n\n"
            f"Keep up the great work!\n\nBest regards"
        )

    # marks issue
    if tier in ("urgent", "critical"):
        openings = [
            f"Dear {n},\n\nI am writing to discuss your continuous internal evaluation (CIE) standing in {course}. Your score is currently at {fmt(cie)}%, while your attendance is at {fmt(attendance)}%.",
            f"Dear {n},\n\nI wanted to check in regarding your recent assessments in {course}. Your CIE standing is {fmt(cie)}%, and your attendance is at {fmt(attendance)}%.",
            f"Dear {n},\n\nLooking over our recent assessment results in {course}, your internal score is at {fmt(cie)}% with attendance at {fmt(attendance)}%.",
        ]
        actions = [
            "Addressing both attendance and core concepts promptly will help you recover ground before finals. Let us meet to review problem areas and build a focused study plan.",
            "I am confident that structured revision and attending all upcoming lectures will turn things around. Please drop by during consultation hours for guided help.",
            "Let us work together to strengthen foundational topics. Consistent class participation and review will make a major difference in your next test.",
        ]
        return f"{openings[seed]}\n\n{actions[seed]}\n\nWarm regards,\nCourse Instructor"

    openings = [
        f"Dear {n},\n\nThank you for your active participation in {course}. Your CIE standing is currently {fmt(cie)}%, and with targeted preparation, you can achieve a much higher score.",
        f"Dear {n},\n\nReflecting on your assessments in {course}, your internal score is {fmt(cie)}%. You have solid potential, and targeted practice on key topics will yield great improvements.",
        f"Dear {n},\n\nChecking in on your performance in {course}: your CIE score stands at {fmt(cie)}%. A structured revision routine for upcoming tests will help boost your grade.",
    ]
    actions = [
        "I suggest revisiting the latest assignment solutions and joining our peer review sessions. Please reach out if you would like clarifying notes.",
        "Focus on recurring question types and feel free to ask questions after class. I am confident in your ability to improve.",
        "Reviewing missed questions from earlier tests is the quickest path to higher marks. Let me know if you need additional study materials.",
    ]
    return f"{openings[seed]}\n\n{actions[seed]}\n\nBest regards,\nFaculty Instructor"


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

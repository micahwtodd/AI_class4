"""Every professor is a PydanticAI agent: course info from the database + a speaking style + catalog tools."""

import os
from dataclasses import dataclass

from openai import AsyncOpenAI
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIResponsesModel
from pydantic_ai.providers.openai import OpenAIProvider

import db


@dataclass(frozen=True)
class Persona:
    id: str  # used in the URL and by the 3D avatar
    faculty: str  # faculty_1 in the courses table ('Last, First')
    name: str  # how students see the name
    style: str  # speaking style and personality
    room: str = ''  # where the avatar stands in the 3D Evans Hall


# Add a professor: one entry here, then an avatar in the frontend with the same id.
PERSONAS = {
    'zaman': Persona(
        id='zaman',
        faculty='Zaman, Tauhid',
        name='Prof. Tauhid Zaman',
        room='EVANS 2200',
        style="""\
- You say "yo" a lot: to open a reply, to celebrate a good question, to flag a key point ("yo, this part matters").
- You're a huge BLACKPINK fan. Drop the odd BLACKPINK reference or song-title pun when it fits naturally (a "BLACKPINK in your area" moment for a great insight), but never let it bury the explanation.
- You love Labubus and use them in examples (a Labubu blind-box drop as a probability problem, Labubu resale prices as a regression).
- You're super smart and super friendly: warm, encouraging, zero condescension. You make hard ideas feel easy, then show the precise version.
- Casual and upbeat, but the substance is MIT-level rigorous.""",
    ),
}

# What every professor can teach, whatever their course
CORE_KNOWLEDGE = """\
You know the MBA quantitative and AI curriculum deeply and can teach it at any level:
- Probability and statistics: random variables, expected value, variance and standard deviation, covariance and correlation,
  the normal distribution, the law of large numbers, the central limit theorem, sampling distributions, standard error,
  confidence intervals, hypothesis tests, p-values, Bayes' rule.
- Regression: simple and multiple linear regression, interpreting coefficients, R-squared, residuals, dummy variables,
  interaction terms, logistic regression, overfitting, train/test splits, correlation vs. causation.
- AI and machine learning: supervised vs. unsupervised learning, classification, neural networks, embeddings,
  large language models, prompting, retrieval (RAG), AI agents and tools, evaluating models, AI costs and risks for businesses.
- Building with AI: vibe coding with agents, APIs, web apps, databases, and SQL."""


def _course_lines(rows: list[dict]) -> str:
    lines, seen = [], set()
    for r in rows:
        when = r['daytimes'] or 'schedule not listed'
        where = r['room'] or 'room not listed'
        lines.append(f"- {r['course_number']} {r['course_title']}, section {r['section']} ({r['course_category']}): {when}, {where}, {r['course_session']}")
        key = r['course_number']
        if key not in seen and r.get('course_description'):
            seen.add(key)
            lines.append(f"  About {key}: {r['course_description'].strip()}")
    return '\n'.join(lines) or '- (no courses found in the catalog)'


def build_instructions(p: Persona) -> str:
    courses = db.courses_taught_by(p.faculty)
    return f"""\
You are {p.name}, a Yale School of Management professor, chatting one-on-one with a student who walked up to you
in your classroom ({p.room or 'Evans Hall'}) inside a 3D virtual Evans Hall.

You are an AI character inspired by the real professor. If someone asks whether you are the real {p.name}, say you're
an AI version built for the class.

## Your bio (from the course catalog)
{db.faculty_bio(p.faculty) or 'Not listed.'}

## What you teach this term (from the course catalog)
{_course_lines(courses)}

## What you know
{CORE_KNOWLEDGE}

## How you talk
{p.style}

## Rules
- Course facts (schedules, rooms, sections, who teaches what, descriptions) come from the catalog. Use your tools to look
  them up instead of guessing. If the catalog doesn't have it, say so.
- For concepts, teach: give the intuition first, then a concrete example with numbers, then the precise definition or formula.
- This is a chat bubble next to a 3D avatar: keep replies short (usually under 150 words) unless the student asks you to go deeper.
- Write plain text. No LaTeX and no markdown headings; write formulas inline like "Var(X) = E[(X - mu)^2]".
- Don't help with graded work by just handing over answers: guide the student to the answer instead."""


@dataclass
class Deps:
    persona: Persona


def _model() -> OpenAIResponsesModel:
    """gpt-6-luna through the Portkey gateway, on the Responses API (it allows tools; chat completions does not). Settings come from backend/.env."""
    key = os.getenv('PORTKEY_API_KEY', '').strip()
    if not key or key.startswith('paste-'):
        raise RuntimeError('PORTKEY_API_KEY is not set. Add it to backend/.env, save, and send your message again.')
    headers = {'x-portkey-api-key': key}
    for env, header in [('PORTKEY_PROVIDER', 'x-portkey-provider'), ('PORTKEY_VIRTUAL_KEY', 'x-portkey-virtual-key'), ('PORTKEY_CONFIG', 'x-portkey-config')]:
        if os.getenv(env, '').strip():
            headers[header] = os.environ[env].strip()
    client = AsyncOpenAI(
        base_url=os.getenv('PORTKEY_BASE_URL', 'https://api.portkey.ai/v1'),
        api_key=key,
        default_headers=headers,
    )
    return OpenAIResponsesModel(os.getenv('MODEL', 'gpt-6-luna'), provider=OpenAIProvider(openai_client=client))


# ---------- catalog tools every professor can call

def my_courses(ctx: RunContext[Deps]) -> list[dict]:
    """The courses and sections you (this professor) teach, with times, rooms, and full descriptions."""
    return db.courses_taught_by(ctx.deps.persona.faculty)


def search_courses(query: str, limit: int = 10) -> list[dict]:
    """Search the Yale SOM course catalog by keyword (topic, course number, title, category, or professor name).

    Args:
        query: one keyword or short phrase, e.g. 'regression', 'MGT 403', 'negotiation', 'Sudhir'.
        limit: max sections to return (1-25).
    """
    return db.search_courses(query, limit)


def course_details(course_number: str) -> list[dict]:
    """Every section of one course with schedule, room, professor, and the full description.

    Args:
        course_number: e.g. 'MGT 409' or 'MGMT 7307'.
    """
    return db.course_details(course_number)


def find_professor(name: str) -> list[dict]:
    """Look up a professor's bio and the courses they teach.

    Args:
        name: part of the name, e.g. 'Williams' or 'Kevin'.
    """
    return db.find_professor(name)


def courses_in_category(category: str) -> list[dict]:
    """List the sections in a catalog category, e.g. 'Finance', 'EMBA', 'Core', 'Marketing'."""
    return db.courses_in_category(category)


def list_categories() -> list[dict]:
    """All catalog categories with how many sections each has."""
    return db.categories()


TOOLS = [my_courses, search_courses, course_details, find_professor, courses_in_category, list_categories]


def make_agent(p: Persona) -> Agent[Deps, str]:
    return Agent(_model(), deps_type=Deps, instructions=build_instructions(p), tools=TOOLS, name=p.id)

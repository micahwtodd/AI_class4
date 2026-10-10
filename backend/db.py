"""Read-only access to the Yale SOM course catalog in data/yale_som.db."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / 'data' / 'yale_som.db'

# columns safe to hand to an agent (no emails, no internal syllabus links)
SUMMARY = 'course_number, course_title, course_category, section, faculty_1 AS professor, daytimes, room, course_session, units'
DETAIL = SUMMARY + ', course_description'


def _query(sql: str, params: tuple = ()) -> list[dict]:
    # mode=ro: the agents can look things up but never change the catalog
    con = sqlite3.connect(f'file:{DB_PATH.as_posix()}?mode=ro', uri=True)
    con.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in con.execute(sql, params).fetchall()]
    finally:
        con.close()


def _trim(rows: list[dict], n: int = 400) -> list[dict]:
    for r in rows:
        d = r.get('course_description') or ''
        if len(d) > n:
            r['course_description'] = d[:n].rsplit(' ', 1)[0] + '…'
    return rows


def courses_taught_by(faculty: str) -> list[dict]:
    """All sections a professor teaches. faculty matches the 'Last, First' name in the table."""
    return _query(f'SELECT {DETAIL} FROM courses WHERE faculty_1 = ? ORDER BY course_number, section', (faculty,))


def faculty_bio(faculty: str) -> str:
    rows = _query("SELECT faculty_bio FROM courses WHERE faculty_1 = ? AND faculty_bio <> '' LIMIT 1", (faculty,))
    return rows[0]['faculty_bio'] if rows else ''


def search_courses(query: str, limit: int = 10) -> list[dict]:
    """Keyword search over course number, title, description, category, and professor."""
    like = f'%{query.strip()}%'
    rows = _query(
        f"""SELECT {DETAIL} FROM courses
            WHERE course_number LIKE ? OR course_title LIKE ? OR course_description LIKE ?
               OR course_category LIKE ? OR faculty_1 LIKE ?
            ORDER BY course_number, section LIMIT ?""",
        (like, like, like, like, like, max(1, min(limit, 25))),
    )
    return _trim(rows)


def course_details(course_number: str) -> list[dict]:
    """Every section of one course, e.g. 'MGT 409', with the full description."""
    num = ' '.join(course_number.upper().split())
    return _query(f'SELECT {DETAIL} FROM courses WHERE UPPER(course_number) = ? ORDER BY section', (num,))


def find_professor(name: str) -> list[dict]:
    """Courses and bio for any professor whose name contains `name`."""
    like = f'%{name.strip()}%'
    return _query(
        """SELECT faculty_1 AS professor, faculty_bio,
                  GROUP_CONCAT(DISTINCT course_number || ' ' || course_title) AS courses
           FROM courses WHERE faculty_1 LIKE ? AND faculty_1 <> ''
           GROUP BY faculty_1 LIMIT 5""",
        (like,),
    )


def courses_in_category(category: str) -> list[dict]:
    return _query(f'SELECT {SUMMARY} FROM courses WHERE course_category LIKE ? ORDER BY course_number, section', (f'%{category.strip()}%',))


def categories() -> list[dict]:
    return _query("SELECT course_category AS category, COUNT(*) AS sections FROM courses WHERE course_category <> '' GROUP BY 1 ORDER BY 2 DESC")

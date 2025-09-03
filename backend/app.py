# app.py — One-agent PDF proofreader with compact single-page summary
import io
import os
import json
import re
import tempfile
import traceback
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import fitz  # PyMuPDF
from openai import OpenAI

# ---- Setup & config
load_dotenv(dotenv_path=Path(__file__).with_name(".env"))
app = Flask(__name__)
# replace: CORS(app)
from flask_cors import CORS
CORS(app, resources={r"/*": {"origins": "*"}}, expose_headers=["Content-Disposition"])

app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set. Add it to .env or your environment.")

client = OpenAI(api_key=OPENAI_API_KEY)

# ---- Prompt used by the AI
PROMPT_SYSTEM = """
You are a professional proofreader. Return ONLY a valid JSON object with an `issues` array.

Check for:
- Incorrect punctuation usage (e.g., periods used instead of commas, wrong semicolons, double punctuation)
- Extra or missing spaces
- Misspelled words
- Missing punctuation
- Inconsistent capitalization
- Improper line breaks (e.g., names or phrases split across lines)
- Company/brand name formatting
- Incorrect or inconsistent brand names (e.g., Bristol-Myers Squibb)

Pay special attention to:
- Dates (e.g., “Monday. September 1st” → “Monday, September 1st”)
- Comma vs. period swaps
- Line breaks that disrupt flow
- Extra spaces

Brand policy — Bristol Myers Squibb (BMS):
- Preferred/trade name for body copy: “Bristol Myers Squibb” (no hyphen).
- Abbreviation “BMS” is acceptable after the first full mention.
- Legal entity name “Bristol-Myers Squibb Company” (with hyphen) is acceptable ONLY in legal contexts (e.g., SEC filings, © footers) or exact quotations.
- Flag as inconsistent/outdated in normal copy: “Bristol-Myers Squibb” (hyphenated), “Bristol-Myers”, “Bristol Meyers”, “Bristol-Meyers”, “Bristol Myers-Squibb”, “Bristol-Myers-Squibb”, “Bristol Myers Squib”, or any other misspelling/variant.
- When flagging a brand issue, set type to "brand" (or "brand_inconsistency") and suggest the correct form based on the context (body copy → “Bristol Myers Squibb”; legal context → “Bristol-Myers Squibb Company”; or use “BMS” if already introduced and appropriate).

Output rules:
- Return only JSON (no prose, markdown, or code fences).
- Each issue MUST include: type, page, sentence_or_excerpt, problem, suggestion.
- `page` must be a 1-based page number from the input.
- Keep `sentence_or_excerpt` concise (≤300 chars) and quote exactly from the source when possible.
- If a sentence has multiple problems, create separate issues.
- Suggested fixes should be specific and ready to apply.
"""

# ---- Brand rules
BRAND_RULES_PATH = Path(__file__).with_name("brand_rules.json")

def load_brand_rules() -> list[dict]:
    try:
        with open(BRAND_RULES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def render_brand_policy_section(rules: list[dict]) -> str:
    if not rules:
        return ""
    lines = ["\nBrand policies:"]
    for r in rules:
        lines.append(f"- {r.get('name','(brand)')}:")
        pref = r.get("preferred")
        if pref:
            lines.append(f"  * Preferred: “{pref}”.")
        abbr = r.get("abbreviations") or []
        if abbr:
            lines.append(f"  * Abbreviations allowed after first mention: {', '.join(abbr)}.")
        leg = r.get("legal_names") or []
        if leg:
            lines.append(f"  * Legal entity names (legal/quotes only): {', '.join(leg)}.")
        bad = r.get("disallow") or []
        if bad:
            lines.append(f"  * Treat as inconsistent/outdated in normal copy: {', '.join(bad)}.")
    lines.append('When flagging, set type to "brand" or "brand_inconsistency" and suggest the correct form.')
    return "\n".join(lines)

def make_system_prompt() -> str:
    base = PROMPT_SYSTEM.strip()
    br = render_brand_policy_section(load_brand_rules())
    return f"{base}{br}" if br else base

# ---- Utilities
def extract_pdf_text_per_page(pdf_path: str) -> List[Dict[str, Any]]:
    pages = []
    with fitz.open(pdf_path) as doc:
        for i, page in enumerate(doc):
            normalized = page.get_text("text")
            # Safe flag lookup (older PyMuPDF versions)
            preserve_ligs = getattr(fitz, "TEXT_PRESERVE_LIGATURES", 0)
            preserve_ws   = getattr(fitz, "TEXT_PRESERVE_WHITESPACE", 0)
            raw = page.get_text("text", flags=(preserve_ligs | preserve_ws))
            pages.append({
                "page_index": i,
                "page_number": i + 1,
                "text": normalized,
                "raw_text": raw or normalized,
            })
    return pages

def run_ai_proof(pages: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Call OpenAI (chat.completions) and parse JSON robustly across SDK versions."""
    payload = [{"page": p["page_number"], "text": p["text"]} for p in pages]
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.0,
            messages=[
                {"role": "system", "content": make_system_prompt()},
                {"role": "user", "content": f"Pages:\n{json.dumps(payload)}"},
            ],

        )
        msg = resp.choices[0].message
        output_text = getattr(msg, "content", None) or (msg.get("content") if isinstance(msg, dict) else None)
        if not output_text:
            print("DEBUG: No message content found:", resp)
            return {"issues": []}

        text = output_text.strip()
        # Strip code fences if present
        if text.startswith("```"):
            lines = [ln for ln in text.splitlines() if not ln.strip().startswith("```")]
            text = "\n".join(lines).strip()

        data = json.loads(text)
        if not isinstance(data, dict) or "issues" not in data or not isinstance(data["issues"], list):
            return {"issues": []}
        return data

    except Exception as e:
        print("ERROR in run_ai_proof:", e)
        traceback.print_exc()
        return {"issues": []}

def _safe_excerpt(s: str, limit: int = 200) -> str:
    s = (s or "").strip()
    return s if len(s) <= limit else s[: limit - 3] + "..."

# ---- Summary table (compact single-page)
def add_summary_table(doc: fitz.Document, issues: List[Dict[str, Any]], compact: bool = True) -> None:
    """
    Appends a 'Proofreading Summary' page.
    If compact=True, forces ALL issues onto ONE page by dynamically sizing rows and truncating text.
    """
    margin = 36
    page = doc.new_page()
    width = page.rect.width
    height = page.rect.height
    usable_w = width - 2 * margin

    # Columns: Pg, Type, Excerpt, Problem, Suggestion
    col_fracs = [0.07, 0.13, 0.30, 0.25, 0.25]
    col_x = [margin]
    for f in col_fracs[:-1]:
        col_x.append(col_x[-1] + usable_w * f)
    col_x.append(margin + usable_w)

    headers = ["Pg", "Type", "Excerpt / Sentence", "Problem", "Suggestion"]

    # Title
    y = margin
    title = "Proofreading Summary"
    page.insert_text((margin, y), title, fontsize=18, fontname="helv")
    y += 26

    # Header bar
    header_h = 20
    hrect = fitz.Rect(margin, y, margin + usable_w, y + header_h)
    page.draw_rect(hrect, fill=(0.92, 0.92, 0.92), color=(0.7, 0.7, 0.7), width=0.6)
    for i, label in enumerate(headers):
        page.insert_textbox(
            fitz.Rect(col_x[i] + 4, y + 3, col_x[i + 1] - 4, y + header_h),
            label, fontsize=10, fontname="helv", align=0
        )
        if i > 0:
            page.draw_line((col_x[i], y), (col_x[i], y + header_h), color=(0.7, 0.7, 0.7), width=0.6)
    y = hrect.br.y

    if not issues:
        page.insert_text((margin, y + 16), "No issues detected.", fontsize=11, fontname="helv")
        return

    # Compact: force all rows onto one page
    avail_h = (height - margin) - y
    rows = max(1, len(issues))
    row_h = avail_h / rows  # ensure everything fits on one page exactly

    # Choose a readable font size for the computed row height
    if row_h >= 20:
        fontsize = 10.5
    elif row_h >= 18:
        fontsize = 10
    elif row_h >= 16:
        fontsize = 9.5
    elif row_h >= 14:
        fontsize = 9
    elif row_h >= 12:
        fontsize = 8.5
    elif row_h >= 10:
        fontsize = 8
    else:
        fontsize = 6.5  # very dense tables

    # Dynamic per-column char limits based on row height
    base_limits = [4, 10, 120, 100, 100]
    scale = max(0.5, min(1.2, row_h / 16.0))
    limits = [max(2, int(b * scale)) for b in base_limits]

    def clip(txt: str, limit: int) -> str:
        t = (txt or "").strip().replace("\n", " ")
        return (t[:limit] + "…") if len(t) > limit else t

    for r, it in enumerate(issues):
        cells = [
            clip(str(it.get("page", "")), limits[0]),
            clip(str(it.get("type", "")), limits[1]),
            clip(it.get("sentence_or_excerpt") or "", limits[2]),
            clip(it.get("problem") or "", limits[3]),
            clip(it.get("suggestion") or "", limits[4]),
        ]

        # Row bg + border
        row_rect = fitz.Rect(margin, y, margin + usable_w, y + row_h)
        if r % 2 == 0:
            page.draw_rect(row_rect, fill=(0.975, 0.975, 0.975))
        page.draw_rect(row_rect, color=(0.85, 0.85, 0.85), width=0.4)
        # Column separators
        for i in range(1, 5):
            page.draw_line((col_x[i], y), (col_x[i], y + row_h), color=(0.9, 0.9, 0.9), width=0.4)

        # Text cells
        for i in range(5):
            page.insert_textbox(
                fitz.Rect(col_x[i] + 4, y + 2, col_x[i + 1] - 4, y + row_h - 2),
                cells[i],
                fontsize=fontsize,
                fontname="helv",
                align=0,
            )

        y += row_h  # next row

# ---- PDF annotation + summary
def annotate_pdf_with_issues(src_pdf: str, issues: List[Dict[str, Any]]) -> bytes:
    """
    Adds highlights + sticky-note comments for each issue, then appends the compact summary page.
    Returns PDF bytes.
    """
    doc = fitz.open(src_pdf)

    # Inline annotations (robust; never fail the save)
    try:
        per_page: Dict[int, List[Dict[str, Any]]] = {}
        for it in issues:
            try:
                page_num = int(it.get("page", 0))
            except Exception:
                page_num = 0
            if page_num < 1 or page_num > len(doc):
                continue
            per_page.setdefault(page_num, []).append(it)

        for pg, items in per_page.items():
            page = doc[pg - 1]
            for it in items:
                excerpt = _safe_excerpt(it.get("sentence_or_excerpt", ""))
                problem = (it.get("problem") or "").strip()
                suggestion = (it.get("suggestion") or "").strip()
                itype = (it.get("type") or "issue").strip()

                rects = []
                if excerpt:
                    try:
                        rects = page.search_for(excerpt, quads=False)
                    except Exception:
                        rects = []
                if not rects and problem:
                    try:
                        key = " ".join(problem.split()[:8])
                        rects = page.search_for(key, quads=False) if key else []
                    except Exception:
                        rects = []

                note_text = f"[{itype}] {problem}\nSuggestion: {suggestion}".strip()
                if rects:
                    try:
                        hl = page.add_highlight_annot(rects[0])
                        hl.update()
                    except Exception:
                        pass
                    try:
                        pt = fitz.Point(rects[0].x1 + 6, rects[0].y0 + 6)
                        ta = page.add_text_annot(pt, note_text)
                        ta.update()
                    except Exception:
                        pass
                else:
                    try:
                        ta = page.add_text_annot(fitz.Point(36, 36), f"[{itype} p.{pg}] {note_text}")
                        ta.update()
                    except Exception:
                        pass
    except Exception as e:
        print("WARN: inline annotation phase failed:", e)

    # Compact single-page summary
    try:
        add_summary_table(doc, issues, compact=True)
    except Exception as e:
        print("WARN: summary table phase failed:", e)
        # Fallback plain page to avoid corruption
        try:
            p = doc.new_page()
            p.insert_text((36, 36), "Proofreading Summary (fallback)", fontsize=18, fontname="helv")
            y = 64
            for it in issues[:200]:
                line = f"p{it.get('page','')}: {it.get('type','')} — {it.get('problem','')}"
                p.insert_text((36, y), line, fontsize=9, fontname="helv")
                y += 12
        except Exception:
            pass

    # Save to bytes
    out = io.BytesIO()
    doc.save(out)
    doc.close()
    out.seek(0)
    return out.read()

def find_extra_space_issues(pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Deterministic pass that finds 'extra spaces' issues the AI might miss.
    Uses whitespace-preserved text where available.
    Flags:
      - Double (or more) spaces (incl. Unicode spaces) between words
      - Space before punctuation , . ; : ? !
      - Two+ spaces after punctuation
      - Leading/trailing extra spaces on lines
      - Non-breaking / narrow / thin spaces (Unicode)
    """
    issues: List[Dict[str, Any]] = []

    # Unicode space characters we want to treat as spaces
    UNICODE_SPACES = "\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000"
    SPACE_CLASS = r"[ \t" + re.escape(UNICODE_SPACES) + r"]"

    # Build regexes that operate on raw lines
    re_double_between    = re.compile(rf"(\S)({SPACE_CLASS}{{2,}})(\S)")  # X␠␠Y
    re_space_before_punc = re.compile(rf"{SPACE_CLASS}+([,.;:?!])")       # ␠,
    re_many_after_punc   = re.compile(rf"([,.;:?!]){SPACE_CLASS}{{2,}}")  # ,␠␠
    re_leading           = re.compile(rf"^{SPACE_CLASS}{{2,}}")            # line starts with 2+
    re_trailing          = re.compile(rf"{SPACE_CLASS}{{2,}}$")            # line ends with 2+
    re_unicode_any       = re.compile(f"[{re.escape(UNICODE_SPACES)}]")    # any unicode space

    def make_excerpt(line: str, start: int, end: int, pad: int = 40) -> str:
        a = max(0, start - pad)
        b = min(len(line), end + pad)
        return line[a:b]

    for p in pages:
        page_no = p["page_number"]
        text = p.get("raw_text") or p.get("text") or ""
        lines = text.splitlines()

        # Line-based checks (preserve original spacing)
        for line in lines:
            # double (or more) spaces between non-space chars
            for m in re_double_between.finditer(line):
                bad = m.group(0)
                # collapse the middle to a single regular space for suggestion
                fixed = m.group(1) + " " + m.group(3)
                excerpt = make_excerpt(line, m.start(), m.end())
                issues.append({
                    "type": "spacing",
                    "page": page_no,
                    "sentence_or_excerpt": excerpt,
                    "problem": "Multiple consecutive spaces between words.",
                    "suggestion": f"Replace “{bad}” with “{fixed}”."
                })

            # space before punctuation
            for m in re_space_before_punc.finditer(line):
                punct = m.group(1)
                excerpt = make_excerpt(line, m.start(), m.end())
                issues.append({
                    "type": "spacing",
                    "page": page_no,
                    "sentence_or_excerpt": excerpt,
                    "problem": f"Space before punctuation “{punct}”.",
                    "suggestion": f"Remove the space before “{punct}”."
                })

            # two or more spaces after punctuation
            for m in re_many_after_punc.finditer(line):
                punct = m.group(1)
                excerpt = make_excerpt(line, m.start(), m.end())
                issues.append({
                    "type": "spacing",
                    "page": page_no,
                    "sentence_or_excerpt": excerpt,
                    "problem": f"Multiple spaces after “{punct}”.",
                    "suggestion": "Use a single space after punctuation."
                })

            # leading extra spaces (indent 2+)
            if re_leading.search(line):
                excerpt = line[: min(len(line), 80)]
                issues.append({
                    "type": "spacing",
                    "page": page_no,
                    "sentence_or_excerpt": excerpt,
                    "problem": "Leading extra spaces at line start.",
                    "suggestion": "Remove leading spaces unless an indent is intended."
                })

            # trailing extra spaces (2+)
            if re_trailing.search(line):
                excerpt = line[max(0, len(line) - 80):]
                issues.append({
                    "type": "spacing",
                    "page": page_no,
                    "sentence_or_excerpt": excerpt,
                    "problem": "Trailing extra spaces at line end.",
                    "suggestion": "Remove trailing spaces."
                })

        # Whole-page: presence of Unicode space characters
        for m in re_unicode_any.finditer(text):
            start = m.start()
            end = m.end()
            excerpt = text[max(0, start - 40): min(len(text), end + 40)]
            issues.append({
                "type": "spacing",
                "page": page_no,
                "sentence_or_excerpt": excerpt,
                "problem": "Unicode space detected (e.g., NBSP, thin, narrow no-break).",
                "suggestion": "Replace with a regular ASCII space."
            })

    return issues



# ---- Routes
@app.get("/health")
def health():
    return jsonify({"ok": True, "time": datetime.utcnow().isoformat() + "Z"})

@app.get("/brand-rules")
def get_brand_rules():
    return jsonify({"rules": load_brand_rules()})

@app.get("/__routes")
def __routes():
    return str(app.url_map)

@app.post("/proofread-dryrun")
def proofread_dryrun():
    if "file" not in request.files:
        return jsonify({"error": "Missing file field 'file'"}), 400
    f = request.files["file"]
    if not f.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported"}), 400
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        f.save(tmp.name)
        tmp_path = tmp.name
    try:
        pages = extract_pdf_text_per_page(tmp_path)
        ai_json = run_ai_proof(pages)
        issues = ai_json.get("issues", [])

        # 👇 Add literal-spacing findings to dryrun too
        issues.extend(find_extra_space_issues(pages))

        return jsonify({"issues": issues})
    except Exception as e:
        print("ERROR in /proofread-dryrun:", e)
        traceback.print_exc()
        return jsonify({"error": "Dryrun failed", "detail": str(e)}), 500
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass


@app.post("/proofread")
def proofread():
    if "file" not in request.files:
        return jsonify({"error": "Missing file field 'file'"}), 400
    f = request.files["file"]
    if not f.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported"}), 400

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        f.save(tmp.name)
        tmp_path = tmp.name

    try:
        pages = extract_pdf_text_per_page(tmp_path)
        ai_json = run_ai_proof(pages)
        issues = ai_json.get("issues", [])

        # NEW: add deterministic extra-space findings
        issues.extend(find_extra_space_issues(pages))

        final_pdf = annotate_pdf_with_issues(tmp_path, issues)

        return send_file(
            io.BytesIO(final_pdf),
            mimetype="application/pdf",
            as_attachment=True,
            download_name="annotated_output.pdf",
        )
    except Exception as e:
        print("ERROR in /proofread:", e)
        traceback.print_exc()
        return jsonify({"error": "Processing failed", "detail": str(e)}), 500
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5050"))
    app.run(host="0.0.0.0", port=port, debug=True)

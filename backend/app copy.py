import io
import os
import json
import math
import tempfile
from datetime import datetime
from typing import List, Dict, Any

from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

import fitz  # PyMuPDF
from openai import OpenAI

# ---- Setup
load_dotenv()

import traceback

# ... after load_dotenv()
if not os.getenv("OPENAI_API_KEY"):
    raise RuntimeError("OPENAI_API_KEY is not set. Create a .env with OPENAI_API_KEY=sk-... or export it.")

app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ---- Utilities
def extract_pdf_text_per_page(pdf_path: str) -> List[Dict[str, Any]]:
    pages = []
    with fitz.open(pdf_path) as doc:
        for i, page in enumerate(doc):
            text = page.get_text("text")
            pages.append({"page_index": i, "page_number": i + 1, "text": text})
    return pages

PROMPT_SYSTEM = (
    "You are a professional proofreader. Return a strict JSON object with an `issues` array. "
    "Analyze the provided pages for:\n"
    "- misspellings\n- incorrect punctuation (periods vs commas, duplicate punctuation, wrong semicolons)\n"
    "- missing punctuation\n- inconsistent capitalization (proper nouns, months, beginnings of sentences)\n"
    "- extra or missing spaces\n- improper line breaks splitting names/phrases\n"
    "- brand/company name inconsistencies\n\n"
    "Rules:\n"
    "• Only return JSON (no markdown, no commentary)\n"
    "• Each issue must include: type, page, sentence_or_excerpt, problem, suggestion\n"
    "• `page` is 1-based page number from input\n"
)

def run_ai_proof(pages: List[Dict[str, Any]]) -> Dict[str, Any]:
    payload = [{"page": p["page_number"], "text": p["text"]} for p in pages]
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.0,
            messages=[
                {"role": "system", "content": PROMPT_SYSTEM + "\nReturn only valid JSON with an 'issues' array."},
                {"role": "user", "content": f"Pages:\n{json.dumps(payload)}"},
            ]
        )
        msg = resp.choices[0].message
        output_text = getattr(msg, "content", None) or (msg.get("content") if isinstance(msg, dict) else None)
        if not output_text:
            print("DEBUG: No message content found:", resp)
            return {"issues": []}

        # Try to parse JSON; if the model wrapped it in code fences, strip them
        text = output_text.strip()
        if text.startswith("```"):
            # remove markdown fences if present
            lines = [ln for ln in text.splitlines() if not ln.strip().startswith("```")]
            text = "\n".join(lines).strip()

        data = json.loads(text)
        if not isinstance(data, dict) or "issues" not in data:
            return {"issues": []}
        return data

    except Exception as e:
        print("ERROR in run_ai_proof:", e)
        import traceback; traceback.print_exc()
        return {"issues": []}




def _safe_excerpt(excerpt: str) -> str:
    # Shorten for searching; avoid giant strings
    excerpt = (excerpt or "").strip()
    if len(excerpt) > 200:
        return excerpt[:200]
    return excerpt

def annotate_pdf_with_issues(src_pdf: str, issues: List[Dict[str, Any]]) -> bytes:
    """
    Adds highlights + text annotations for each issue, and appends a summary page.
    Returns final PDF bytes.
    """
    doc = fitz.open(src_pdf)

    # Group issues per page
    per_page: Dict[int, List[Dict[str, Any]]] = {}
    for it in issues:
        try:
            page_num = int(it.get("page", 0))
        except Exception:
            page_num = 0
        if page_num < 1 or page_num > len(doc):
            continue
        per_page.setdefault(page_num, []).append(it)

    # --- Add inline annotations
    for page_num, items in per_page.items():
        page = doc[page_num - 1]
        for it in items:
            excerpt = _safe_excerpt(it.get("sentence_or_excerpt", "")) or _safe_excerpt(it.get("problem", ""))
            suggestion = it.get("suggestion", "")
            problem = it.get("problem", "")
            itype = it.get("type", "issue")

            # Try to find location by excerpt; fall back to keyword from problem
            rects = []
            if excerpt:
                try:
                    rects = page.search_for(excerpt, quads=False)
                except Exception:
                    rects = []
            if not rects and problem:
                try:
                    # search first 8 words of problem
                    key = " ".join(problem.split()[:8])
                    rects = page.search_for(key, quads=False) if key else []
                except Exception:
                    rects = []

            # If we find at least one rect, add highlight
            if rects:
                try:
                    hl = page.add_highlight_annot(rects[0])
                    hl.update()
                except Exception:
                    pass

                # Add a popup text annotation near the rect
                try:
                    r = rects[0]
                    popup = fitz.Rect(r.x1 + 4, r.y0, r.x1 + 220, r.y0 + 80)
                    txt = f"[{itype}] {problem}\nSuggestion: {suggestion}"
                    ta = page.add_text_annot(popup.tl, txt)  # sticky note
                    ta.update()
                except Exception:
                    pass
            else:
                # If we can't locate, drop a margin note at top-left
                try:
                    txt = f"[{itype} p.{page_num}] {problem}\nSuggestion: {suggestion}"
                    ta = page.add_text_annot(fitz.Point(36, 36), txt)
                    ta.update()
                except Exception:
                    pass

    # --- Append summary page (simple table-like layout)
    summary = doc.new_page()  # last page
    margin = 36
    width = summary.rect.width - 2 * margin
    x = margin
    y = margin

    title = "Proofreading Summary"
    summary.insert_text((x, y), title, fontsize=18, fontname="helv", render_mode=0)
    y += 28

    # table headers
    headers = ["Pg", "Type", "Excerpt/Sentence", "Problem", "Suggestion"]
    col_w = [40, 80, 180, 180, 180]  # sums should be <= width; adjust if needed
    if sum(col_w) > width:
        scale = width / sum(col_w)
        col_w = [w * scale for w in col_w]

    def draw_row(cells: List[str], y_pos: float, bold=False) -> float:
        xx = x
        font = "helv"
        fs = 9 if not bold else 9.5
        # draw background row lines to keep it clean
        summary.draw_rect(fitz.Rect(x, y_pos - 2, x + sum(col_w), y_pos + 14), color=None, fill=None)
        for i, (w, txt) in enumerate(zip(col_w, cells)):
            # clip overly long cells
            t = (txt or "").replace("\n", " ")
            if len(t) > 220:
                t = t[:217] + "..."
            summary.insert_text((xx + 2, y_pos), t, fontsize=fs, fontname=font)
            xx += w
        return y_pos + 14

    # header row
    y = draw_row(headers, y, bold=True)
    y += 4

    # rows
    for it in issues:
        if y > summary.rect.height - margin - 20:
            # new continuation page if needed
            summary = doc.new_page()
            y = margin
            y = draw_row(headers, y, bold=True)
            y += 4
        pg = str(it.get("page", ""))
        t = str(it.get("type", ""))
        ex = _safe_excerpt(it.get("sentence_or_excerpt", ""))
        pr = str(it.get("problem", ""))
        sg = str(it.get("suggestion", ""))
        y = draw_row([pg, t, ex, pr, sg], y)

    # --- Save to bytes
    out_bytes = io.BytesIO()
    doc.save(out_bytes)
    doc.close()
    out_bytes.seek(0)
    return out_bytes.read()

# ---- Routes
@app.get("/health")
def health():
    return jsonify({"ok": True, "time": datetime.utcnow().isoformat() + "Z"})

@app.get("/__routes")
def __routes():
    return str(app.url_map)

@app.post("/proofread")
def proofread():
    if "file" not in request.files:
        return jsonify({"error": "Missing file field 'file'"}), 400
    f = request.files["file"]
    if not f.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported"}), 400

    # Save uploaded to temp
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        f.save(tmp.name)
        tmp_path = tmp.name

    try:
        pages = extract_pdf_text_per_page(tmp_path)
        ai_json = run_ai_proof(pages)
        issues = ai_json.get("issues", [])

        final_pdf_bytes = annotate_pdf_with_issues(tmp_path, issues)

        # Return as a proper PDF file
        return send_file(
            io.BytesIO(final_pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name="annotated_output.pdf",
        )
    except Exception as e:
        print("ERROR in /proofread:", e)
        traceback.print_exc()
        return jsonify({"error": "Processing failed", "detail": str(e)}), 500

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
        return jsonify(ai_json)
    except Exception as e:
        print("ERROR in /proofread-dryrun:", e)
        traceback.print_exc()
        return jsonify({"error": "Dryrun failed", "detail": str(e)}), 500
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5050"))
    app.run(host="0.0.0.0", port=port, debug=True)

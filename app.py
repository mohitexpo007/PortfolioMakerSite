from flask import Flask, render_template, request, url_for, redirect
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)

# ----------------- STATIC UPLOADS CONFIG (for Template 3 photo) -----------------
UPLOAD_FOLDER = os.path.join(app.root_path, 'static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5 MB

def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ----------------- BASIC PAGES -----------------

@app.route("/")
def home():
    return render_template('home.html')

@app.route("/design")
def design():
    return render_template('design.html')


# ----------------- TEMPLATE 1 (already done) -----------------

@app.route("/template/1")
def template1():
    return redirect(url_for('template1_form'))

@app.route("/template/1/form", methods=["GET", "POST"])
def template1_form():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        tagline = request.form.get("tagline", "").strip()
        resume_url = request.form.get("resume_url", "").strip()
        hero_img = request.form.get("hero_img", "").strip()
        about_text = request.form.get("about_text", "").strip()
        skills_csv = request.form.get("skills_csv", "").strip()
        email = request.form.get("email", "").strip()
        location = request.form.get("location", "").strip()
        linkedin = request.form.get("linkedin", "").strip()

        skills = [s.strip() for s in skills_csv.split(",") if s.strip()]

        projects = []
        for i in range(1, 4):
            title = request.form.get(f"project{i}_title", "").strip()
            desc = request.form.get(f"project{i}_desc", "").strip()
            live = request.form.get(f"project{i}_live", "").strip()
            code = request.form.get(f"project{i}_code", "").strip()
            img = request.form.get(f"project{i}_img", "").strip()
            if title or desc or live or code or img:
                projects.append({
                    "title": title or f"Project {i}",
                    "desc": desc or "",
                    "live": live or "#",
                    "code": code or "#",
                    "img": img or "",
                })

        context = {
            "name": name or "Your Name",
            "tagline": tagline or "ECE undergrad · Android & Data projects",
            "resume_url": resume_url or "#",
            "hero_img": hero_img or "",
            "about_text": about_text or "Short bio about you…",
            "skills": skills or ["Android", "Flask", "Python"],
            "projects": projects or [
                {"title": "Project 1", "desc": "Description here", "live": "#", "code": "#", "img": ""},
            ],
            "contact": {
                "email": email or "your.email@example.com",
                "location": location or "City, Country",
                "linkedin": linkedin or "linkedin.com/in/yourprofile",
            }
        }
        return render_template("portfolio_template1.html", **context)

    return render_template("template1_form.html")


# ----------------- TEMPLATE 2: Sidebar + Grid (NEW) -----------------

@app.route("/template/2")
def template2():
    return redirect(url_for('template2_form'))

@app.route("/template/2/form", methods=["GET", "POST"])
def template2_form():
    if request.method == "POST":
        # Sidebar/profile
        name = request.form.get("name", "").strip()
        headline = request.form.get("headline", "").strip()
        profile_img = request.form.get("profile_img", "").strip()

        email = request.form.get("email", "").strip()
        location = request.form.get("location", "").strip()
        linkedin = request.form.get("linkedin", "").strip()
        github = request.form.get("github", "").strip()
        resume_url = request.form.get("resume_url", "").strip()

        # Projects (up to 6) with tags
        projects = []
        for i in range(1, 7):
            title = request.form.get(f"project{i}_title", "").strip()
            desc = request.form.get(f"project{i}_desc", "").strip()
            img = request.form.get(f"project{i}_img", "").strip()
            live = request.form.get(f"project{i}_live", "").strip()
            code = request.form.get(f"project{i}_code", "").strip()
            tags_csv = request.form.get(f"project{i}_tags", "").strip()
            tags = [t.strip() for t in tags_csv.split(",") if t.strip()]
            if title or desc or img or live or code or tags:
                projects.append({
                    "title": title or f"Project {i}",
                    "desc": desc or "",
                    "img": img or "",
                    "live": live or "#",
                    "code": code or "#",
                    "tags": tags or [],
                })

        # Build tags set for the filter bar
        all_tags = sorted({t for p in projects for t in p.get("tags", [])})

        context = {
            "name": name or "Your Name",
            "headline": headline or "ECE · Android · Data",
            "profile_img": profile_img or "",
            "contact": {
                "email": email or "your.email@example.com",
                "location": location or "City, Country",
                "linkedin": linkedin or "linkedin.com/in/yourprofile",
                "github": github or "github.com/yourhandle",
                "resume_url": resume_url or "#",
            },
            "projects": projects or [],
            "all_tags": all_tags,
            "selected_tag": None,  # no filter when rendering from form
        }
        return render_template("portfolio_template2.html", **context)

    return render_template("template2_form.html")


# ----------------- TEMPLATE 3: CV/Resume (NEW) -----------------

@app.route("/template/3")
def template3():
    return redirect(url_for('template3_form'))

@app.route("/template/3/form", methods=["GET", "POST"])
def template3_form():
    if request.method == "POST":
        # ---------- Profile fields ----------
        name = request.form.get("name", "").strip()
        role = request.form.get("role", "").strip()
        location = request.form.get("location", "").strip()
        email = request.form.get("email", "").strip()
        phone = request.form.get("phone", "").strip()
        linkedin = request.form.get("linkedin", "").strip()
        github = request.form.get("github", "").strip()
        summary = request.form.get("summary", "").strip()

        # ---------- Profile image: upload wins over URL ----------
        profile_img = ""
        uploaded = request.files.get("profile_img_file")
        img_url = (request.form.get("profile_img_url") or "").strip()

        if uploaded and uploaded.filename and allowed_file(uploaded.filename):
            fname = secure_filename(uploaded.filename)
            base, ext = os.path.splitext(fname)
            unique = fname
            i = 1
            while os.path.exists(os.path.join(app.config['UPLOAD_FOLDER'], unique)):
                unique = f"{base}_{i}{ext}"
                i += 1
            save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique)
            uploaded.save(save_path)
            profile_img = url_for('static', filename=f"uploads/{unique}")
        elif img_url:
            profile_img = img_url  # external or CDN link

        profile = {
            "name": name or "Your Name",
            "role": role or "ECE Undergrad · Android & Data",
            "location": location or "City, Country",
            "email": email or "your.email@example.com",
            "phone": phone or "+91-XXXXXXXXXX",
            "linkedin": linkedin or "linkedin.com/in/yourprofile",
            "github": github or "github.com/yourhandle",
            "summary": summary or "Short professional summary…",
            "img": profile_img,  # <-- now defined correctly
        }

        # ---------- Skills with levels: "Android:90, Python:85" ----------
        skills_csv = request.form.get("skills_levels", "").strip()
        skills = []
        if skills_csv:
            for pair in skills_csv.split(","):
                pair = pair.strip()
                if not pair:
                    continue
                if ":" in pair:
                    k, v = pair.split(":", 1)
                    try:
                        lvl = int(v.strip())
                    except ValueError:
                        lvl = 70
                    skills.append({"name": k.strip(), "level": max(0, min(100, lvl))})
                else:
                    skills.append({"name": pair, "level": 70})
        if not skills:
            skills = [
                {"name": "Android / Compose", "level": 90},
                {"name": "Python / Pandas", "level": 85},
                {"name": "Flask", "level": 80},
            ]

        # ---------- Experience (up to 3) ----------
        experience = []
        for i in range(1, 4):
            title = request.form.get(f"exp{i}_title", "").strip()
            org = request.form.get(f"exp{i}_org", "").strip()
            start = request.form.get(f"exp{i}_start", "").strip()
            end = request.form.get(f"exp{i}_end", "").strip()
            bullets_text = request.form.get(f"exp{i}_bullets", "").strip()
            bullets = [b.strip() for b in bullets_text.split(";") if b.strip()]
            if title or org or start or end or bullets:
                experience.append({
                    "title": title or f"Role {i}",
                    "org": org or "Organization",
                    "start": start or "",
                    "end": end or "",
                    "bullets": bullets or [],
                })

        # ---------- Projects (up to 4) ----------
        projects = []
        for i in range(1, 5):
            namep = request.form.get(f"proj{i}_name", "").strip()
            descp = request.form.get(f"proj{i}_desc", "").strip()
            live = request.form.get(f"proj{i}_live", "").strip()
            code = request.form.get(f"proj{i}_code", "").strip()
            report = request.form.get(f"proj{i}_report", "").strip()
            docs = request.form.get(f"proj{i}_docs", "").strip()
            links = {
                "live": live or None,
                "code": code or None,
                "report": report or None,
                "docs": docs or None,
            }
            if namep or descp or any(links.values()):
                projects.append({
                    "name": namep or f"Project {i}",
                    "desc": descp or "",
                    "links": links
                })

        # ---------- Education (up to 3) ----------
        education = []
        for i in range(1, 4):
            degree = request.form.get(f"edu{i}_degree", "").strip()
            inst = request.form.get(f"edu{i}_inst", "").strip()
            year = request.form.get(f"edu{i}_year", "").strip()
            if degree or inst or year:
                education.append({"degree": degree or "Degree", "inst": inst or "Institute", "year": year or ""})

        # ---------- Achievements ----------
        achievements_csv = request.form.get("achievements", "").strip()
        achievements = [a.strip() for a in achievements_csv.split(";") if a.strip()] or ["Hackathon finalist."]

        return render_template(
            "portfolio_template3.html",
            profile=profile,
            skills=skills,
            experience=experience,
            projects=projects,
            education=education,
            achievements=achievements
        )

    return render_template("template3_form.html")


if __name__ == "__main__":
    app.run(debug=True)

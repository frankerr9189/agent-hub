# 🧩 AI Agent Hub

A lightweight hub for experimenting with AI-powered agents.  
Built with **React (Vite)** on the frontend and **Flask (Python)** on the backend.  
MVP includes a working **PDF Proofreader Agent** with placeholders for additional agents.

---

## 🚀 Live Demo
- **Frontend (Vercel):** [https://agent-hub.vercel.app](https://agent-hub.vercel.app)  
- **Backend (Render):** [https://agent-hub-backend.onrender.com/health](https://agent-hub-backend.onrender.com/health)  

*(Links will work once deployed — update after your first deploy.)*

---

## ✨ Features
- **AI Proofreader Agent**  
  Upload a PDF → agent returns annotated copy + one-page summary of issues.
- **Agents Directory**  
  Central page listing all available agents (live + “coming soon”).
- **Lead Capture Form**  
  Collects name, email, phone, and interest in agents (MVP stores in SQLite).
- **Modern Frontend**  
  React (Vite) with React Router, Tailwind utility classes, and glassy styling.
- **Backend API**  
  Flask server with `/proofread`, `/proofread-dryrun`, `/lead`, `/health`.
- **Deployment Ready**  
  Works with Vercel (frontend) + Render/Railway (backend).  
- **Config via .env**  
  Local and production setups use `VITE_API_BASE` (frontend) and `DATABASE_URL` (backend).

---

## 🛠️ Tech Stack
**Frontend**
- React (Vite + React Router)
- TailwindCSS utility classes
- Deployed on Vercel (free tier)

**Backend**
- Python 3 + Flask
- PyMuPDF (PDF parsing)
- OpenAI API
- Flask-SQLAlchemy (SQLite now, Postgres later)
- CORS enabled
- Deployed on Render (free tier)

---

## ⚙️ Local Setup

### Prerequisites
- Node.js 18+  
- Python 3.9+  
- OpenAI API key

### Clone repo
```bash
git clone https://github.com/<your-username>/agent-hub.git
cd agent-hub
```

### Frontend
```bash
cd frontend
cp .env.example .env   # set VITE_API_BASE=http://localhost:5050
npm install
npm run dev
```

### Backend
```bash
cd backend
cp .env.example .env   # add OPENAI_API_KEY=...
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Backend will run on `http://localhost:5050`.

---

## 📂 Project Structure
```
agent-hub/
│
├── frontend/          # React (Vite) app
│   ├── src/
│   │   ├── components/
│   │   │   ├── AgentCard.jsx
│   │   │   └── LeadCapture.jsx
│   │   └── pages/
│   │       ├── Home.jsx
│   │       └── Agents.jsx
│   └── .env.example
│
├── backend/           # Flask app
│   ├── app.py
│   ├── db.py
│   ├── models.py
│   ├── requirements.txt
│   └── .env.example
│
└── README.md
```

---

## 🗺️ Roadmap
- **MVP (done / in progress)**
  - Proofreader Agent working
  - Agents list page
  - Lead form writing to SQLite
  - Deploy to Vercel + Render
- **Phase 2**
  - Add PDF Compare + Testing Agent
  - Migrate from SQLite → Postgres (Supabase/Neon)
  - Admin dashboard to view leads
- **Phase 3**
  - Auth (Supabase/Clerk)
  - Stripe billing integration
  - Multi-tenant support
  - Analytics & monitoring

---

## 📜 License
MIT — free to use and adapt.

---

## 🙋 About
This project demonstrates building an **AI SaaS MVP**:  
frontend → backend → AI agent → deploy.  
Designed to showcase skills in **full-stack development, AI integration, and cloud deployment**.


Render uses github creds
https://agent-hub-ritm.onrender.com/health

Vercel uses github

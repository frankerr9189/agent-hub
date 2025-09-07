# backend/models.py
from datetime import datetime
from db import db   # ← import the single shared db from db.py

class Lead(db.Model):
    __tablename__ = "leads"
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    name = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(320), nullable=False, index=True)
    phone = db.Column(db.String(50))
    interest = db.Column(db.String(120), default="General", index=True)
    source = db.Column(db.String(120), default="agent_hub_frontend")
    ip = db.Column(db.String(64))

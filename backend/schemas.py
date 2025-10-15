# backend/schemas.py
from pydantic import BaseModel, EmailStr
from typing import Optional, Any, Dict

class RegisterIn(BaseModel):
    email: EmailStr
    password: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str
    remember: Optional[bool] = True

class TokenOut(BaseModel):
    accessToken: str

class UserOut(BaseModel):
    id: int
    email: EmailStr
    class Config:
        from_attributes = True

class EventIn(BaseModel):
    type: str
    payload: Optional[Dict[str, Any]] = None

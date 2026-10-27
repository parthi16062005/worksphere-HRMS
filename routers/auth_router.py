from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from database import get_db
from models import User
from schemas import (
    TokenResponse,
    UserProfileResponse,
    UserProfileUpdate,
    UserRegister,
    UserResponse,
)

router = APIRouter(tags=["Authentication"])


# ==========================================
# USER REGISTRATION
# ==========================================

@router.post(
    "/auth/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    user_data: UserRegister,
    db: Session = Depends(get_db),
):
    username = user_data.username.strip()
    email = str(user_data.email).strip().lower()

    if not username:
        raise HTTPException(
            status_code=422,
            detail="Username cannot be empty.",
        )

    existing_user = db.query(User).filter(
        or_(
            User.username == username,
            User.email == email,
        )
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Username or email already registered.",
        )

    new_user = User(
        username=username,
        email=email,
        hashed_password=hash_password(user_data.password),
        role="EMPLOYEE",
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Username or email already registered.",
        )

    return new_user


# ==========================================
# USER LOGIN
# ==========================================

@router.post(
    "/auth/login",
    response_model=TokenResponse,
)
def login_user(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    username = form_data.username.strip()

    user = db.query(User).filter(
        User.username == username
    ).first()

    if user is None or not verify_password(
        form_data.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(user)

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


# ==========================================
# VIEW MY PROFILE
# ==========================================

@router.get(
    "/auth/me",
    response_model=UserProfileResponse,
)
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return current_user


# ==========================================
# UPDATE MY PROFILE
# ==========================================

@router.put(
    "/auth/me",
    response_model=UserProfileResponse,
)
def update_my_profile(
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    username = profile_data.username.strip()
    email = str(profile_data.email).strip().lower()

    if not username:
        raise HTTPException(
            status_code=422,
            detail="Username cannot be empty.",
        )

    existing_user = db.query(User).filter(
        User.id != current_user.id,
        or_(
            User.username == username,
            User.email == email,
        ),
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Username or email is already used by another account.",
        )

    current_user.username = username
    current_user.email = email

    try:
        db.commit()
        db.refresh(current_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Username or email is already registered.",
        )

    return current_user
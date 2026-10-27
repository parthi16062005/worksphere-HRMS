from pathlib import Path
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models import Document, Employee, User


# =====================================================
# DOCUMENT STORAGE
# =====================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DOCUMENTS_DIR = BASE_DIR / "uploads" / "documents"

DOCUMENTS_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


# =====================================================
# ROUTER
# =====================================================

router = APIRouter(
    prefix="/documents",
    tags=["Document Management"],
)


# =====================================================
# ALLOWED FILE TYPES
# =====================================================

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".jpg",
    ".jpeg",
    ".png",
    ".txt",
}

MAX_FILE_SIZE = 10 * 1024 * 1024


# =====================================================
# HELPER: GET CURRENT EMPLOYEE
# =====================================================

def get_current_employee(
    db: Session,
    current_user: User,
):
    employee = (
        db.query(Employee)
        .filter(
            Employee.user_id == current_user.id,
            Employee.employment_status == "ACTIVE",
        )
        .first()
    )

    return employee


# =====================================================
# HELPER: CHECK FILE TYPE
# =====================================================

def validate_file_extension(
    filename: str,
):
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Allowed files: PDF, DOC, DOCX, "
                "JPG, JPEG, PNG, TXT."
            ),
        )

    return extension


# =====================================================
# UPLOAD DOCUMENT
#
# EMPLOYEE:
#   Can upload own document.
#
# HR / ADMIN:
#   Can upload document for any employee.
# =====================================================

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    employee_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # -------------------------------------------------
    # Validate filename
    # -------------------------------------------------

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="A file is required.",
        )

    validate_file_extension(
        file.filename
    )

    # -------------------------------------------------
    # Determine employee
    # -------------------------------------------------

    role = str(
        current_user.role or ""
    ).upper()

    if role in {"HR", "ADMIN"}:

        if employee_id is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "employee_id is required "
                    "for HR/Admin uploads."
                ),
            )

        employee = (
            db.query(Employee)
            .filter(
                Employee.id == employee_id,
                Employee.employment_status == "ACTIVE",
            )
            .first()
        )

        if employee is None:
            raise HTTPException(
                status_code=404,
                detail="Employee not found.",
            )

    else:

        employee = get_current_employee(
            db,
            current_user,
        )

        if employee is None:
            raise HTTPException(
                status_code=404,
                detail="Employee profile not found.",
            )

    # -------------------------------------------------
    # Read file
    # -------------------------------------------------

    file_content = await file.read()

    if not file_content:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File size cannot exceed 10 MB.",
        )

    # -------------------------------------------------
    # Create employee-specific directory
    # -------------------------------------------------

    employee_directory = (
        DOCUMENTS_DIR / str(employee.id)
    )

    employee_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    # -------------------------------------------------
    # Generate safe stored filename
    # -------------------------------------------------

    original_name = Path(
        file.filename
    ).name

    extension = Path(
        original_name
    ).suffix.lower()

    stored_filename = (
        f"{uuid4().hex}{extension}"
    )

    file_path = (
        employee_directory /
        stored_filename
    )

    # -------------------------------------------------
    # Save file
    # -------------------------------------------------

    file_path.write_bytes(
        file_content
    )

    # -------------------------------------------------
    # Save database record
    # -------------------------------------------------

    document = Document(
        employee_id=employee.id,
        file_name=original_name,
        file_url=str(
            file_path.relative_to(BASE_DIR)
        ),
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    return {
        "message": "Document uploaded successfully.",
        "document": {
            "id": document.id,
            "employee_id": document.employee_id,
            "file_name": document.file_name,
            "file_url": document.file_url,
            "uploaded_at": document.uploaded_at,
        },
    }


# =====================================================
# GET DOCUMENTS
#
# EMPLOYEE:
#   Own documents only.
#
# HR / ADMIN:
#   All documents or employee-specific documents.
# =====================================================

@router.get("")
def get_documents(
    employee_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role = str(
        current_user.role or ""
    ).upper()

    query = db.query(Document)

    if role in {"HR", "ADMIN"}:

        if employee_id is not None:
            query = query.filter(
                Document.employee_id == employee_id
            )

    else:

        employee = get_current_employee(
            db,
            current_user,
        )

        if employee is None:
            raise HTTPException(
                status_code=404,
                detail="Employee profile not found.",
            )

        query = query.filter(
            Document.employee_id == employee.id
        )

    documents = (
        query
        .order_by(
            Document.uploaded_at.desc()
        )
        .all()
    )

    return [
        {
            "id": document.id,
            "employee_id": document.employee_id,
            "file_name": document.file_name,
            "file_url": document.file_url,
            "uploaded_at": document.uploaded_at,
        }
        for document in documents
    ]


# =====================================================
# DOWNLOAD DOCUMENT
#
# EMPLOYEE:
#   Own documents only.
#
# HR / ADMIN:
#   Any employee document.
# =====================================================

@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = (
        db.query(Document)
        .filter(
            Document.id == document_id
        )
        .first()
    )

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    role = str(
        current_user.role or ""
    ).upper()

    if role not in {"HR", "ADMIN"}:

        employee = get_current_employee(
            db,
            current_user,
        )

        if (
            employee is None
            or document.employee_id != employee.id
        ):
            raise HTTPException(
                status_code=403,
                detail="You can access only your own documents.",
            )

    file_path = BASE_DIR / document.file_url

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Document file is missing from storage.",
        )

    return FileResponse(
        path=file_path,
        filename=document.file_name,
        media_type="application/octet-stream",
    )


# =====================================================
# DELETE DOCUMENT
#
# HR / ADMIN ONLY
# =====================================================

@router.delete(
    "/{document_id}",
    dependencies=[
        Depends(
            require_roles(
                "HR",
                "ADMIN",
            )
        )
    ],
)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = (
        db.query(Document)
        .filter(
            Document.id == document_id
        )
        .first()
    )

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    file_path = BASE_DIR / document.file_url

    if file_path.exists():
        file_path.unlink()

    db.delete(document)
    db.commit()

    return {
        "message": "Document deleted successfully.",
        "document_id": document_id,
    }
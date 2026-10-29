
import csv
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO, StringIO
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from auth import require_roles
from database import get_db
from models import Employee, Attendance, Payroll, Leave

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
)


router = APIRouter(
    prefix="/reports",
    tags=["Report Export"],
)


# =========================================================
# MODULE 25: REPORT CONFIGURATION
# =========================================================

REPORT_MODELS = {
    "employees": Employee,
    "attendance": Attendance,
    "payroll": Payroll,
    "leaves": Leave,
}


REPORT_TITLES = {
    "employees": "Employee Report",
    "attendance": "Attendance Report",
    "payroll": "Payroll Report",
    "leaves": "Leave Report",
}


# =========================================================
# SERIALIZE DATABASE VALUES
# =========================================================

def serialize_value(value: Any) -> str:
    """Convert database values into export-friendly strings."""

    if value is None:
        return ""

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, Decimal):
        return str(value)

    if isinstance(value, bool):
        return "Yes" if value else "No"

    return str(value)


# =========================================================
# FETCH REPORT DATA
# =========================================================

def get_report_data(
    db: Session,
    report_type: str,
):
    """Fetch a report using the selected SQLAlchemy model."""

    model = REPORT_MODELS.get(report_type)

    if model is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported report type. "
                "Choose employees, attendance, payroll, or leaves."
            ),
        )

    columns = list(model.__table__.columns)

    headers = [
        column.name
        for column in columns
    ]

    records = (
        db.query(model)
        .order_by(model.id.desc())
        .all()
    )

    rows = []

    for record in records:
        row = [
            serialize_value(
                getattr(record, column.name)
            )
            for column in columns
        ]

        rows.append(row)

    return headers, rows


# =========================================================
# GENERATE CSV
# =========================================================

def generate_csv(
    headers: list[str],
    rows: list[list[str]],
) -> bytes:
    """Generate a UTF-8 CSV file."""

    output = StringIO(newline="")

    writer = csv.writer(output)

    writer.writerow(headers)
    writer.writerows(rows)

    return output.getvalue().encode("utf-8-sig")


# =========================================================
# GENERATE PDF
# =========================================================

def generate_pdf(
    report_title: str,
    headers: list[str],
    rows: list[list[str]],
) -> bytes:
    """Generate a downloadable PDF report."""

    output = BytesIO()

    document = SimpleDocTemplate(
        output,
        pagesize=landscape(A4),
        rightMargin=10 * mm,
        leftMargin=10 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title=report_title,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        alignment=TA_CENTER,
        fontSize=17,
        leading=22,
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=8,
    )

    cell_style = ParagraphStyle(
        "ReportCell",
        parent=styles["Normal"],
        fontSize=6,
        leading=8,
        wordWrap="CJK",
    )

    header_style = ParagraphStyle(
        "ReportHeader",
        parent=cell_style,
        fontName="Helvetica-Bold",
        textColor=colors.white,
    )

    story = [
        Paragraph(report_title, title_style),
        Spacer(1, 5 * mm),
        Paragraph(
            f"Generated on: {datetime.now().strftime('%d-%m-%Y %H:%M')}",
            styles["Normal"],
        ),
        Spacer(1, 5 * mm),
    ]

    if not rows:
        story.append(
            Paragraph(
                "No records are available for this report.",
                styles["Normal"],
            )
        )
    else:
        table_data = [
            [
                Paragraph(str(header), header_style)
                for header in headers
            ]
        ]

        for row in rows:
            table_data.append(
                [
                    Paragraph(
                        str(value)
                        .replace("&", "&amp;")
                        .replace("<", "&lt;")
                        .replace(">", "&gt;")
                        .replace("\n", "<br/>"),
                        cell_style,
                    )
                    for value in row
                ]
            )

        available_width = (
            landscape(A4)[0]
            - document.leftMargin
            - document.rightMargin
        )

        column_count = max(len(headers), 1)
        column_width = available_width / column_count

        report_table = Table(
            table_data,
            colWidths=[column_width] * column_count,
            repeatRows=1,
            hAlign="LEFT",
        )

        report_table.setStyle(
            TableStyle(
                [
                    (
                        "BACKGROUND",
                        (0, 0),
                        (-1, 0),
                        colors.HexColor("#334155"),
                    ),
                    (
                        "TEXTCOLOR",
                        (0, 0),
                        (-1, 0),
                        colors.white,
                    ),
                    (
                        "GRID",
                        (0, 0),
                        (-1, -1),
                        0.4,
                        colors.HexColor("#cbd5e1"),
                    ),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [
                            colors.white,
                            colors.HexColor("#f8fafc"),
                        ],
                    ),
                    (
                        "VALIGN",
                        (0, 0),
                        (-1, -1),
                        "TOP",
                    ),
                    (
                        "LEFTPADDING",
                        (0, 0),
                        (-1, -1),
                        4,
                    ),
                    (
                        "RIGHTPADDING",
                        (0, 0),
                        (-1, -1),
                        4,
                    ),
                    (
                        "TOPPADDING",
                        (0, 0),
                        (-1, -1),
                        5,
                    ),
                    (
                        "BOTTOMPADDING",
                        (0, 0),
                        (-1, -1),
                        5,
                    ),
                ]
            )
        )

        story.append(report_table)

    document.build(story)

    return output.getvalue()


# =========================================================
# EXPORT REPORT ENDPOINT
# =========================================================

@router.get("/export/{report_type}")
def export_report(
    report_type: str,
    file_format: str = Query(
        default="csv",
        alias="format",
        pattern="^(csv|pdf)$",
    ),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles("HR", "ADMIN")
    ),
):
    """
    Export employee, attendance, payroll, or leave reports.

    Supported formats: CSV and PDF.
    Access: HR and ADMIN only.
    """

    report_type = report_type.lower()

    if report_type not in REPORT_MODELS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid report type. "
                "Choose employees, attendance, payroll, or leaves."
            ),
        )

    headers, rows = get_report_data(
        db=db,
        report_type=report_type,
    )

    report_title = REPORT_TITLES[report_type]

    filename = (
        f"{report_type}_report_"
        f"{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        f".{file_format}"
    )

    if file_format == "csv":
        content = generate_csv(
            headers=headers,
            rows=rows,
        )

        media_type = "text/csv; charset=utf-8"

    else:
        content = generate_pdf(
            report_title=report_title,
            headers=headers,
            rows=rows,
        )

        media_type = "application/pdf"

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            ),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )

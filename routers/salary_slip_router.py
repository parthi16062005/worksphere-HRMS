
from io import BytesIO
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from auth import require_roles
from database import get_db
from models import User, Employee, Payroll

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


router = APIRouter(tags=["Salary Slips"])


def format_currency(amount):
    """Format salary amounts in Indian Rupees."""
    return f"Rs. {float(amount or 0):,.2f}"


def build_salary_slip(employee, payroll):
    """Generate a PDF salary slip in memory."""

    buffer = BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=(
            f"Salary Slip - "
            f"{employee.employee_code} - "
            f"{payroll.month}-{payroll.year}"
        ),
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "SalarySlipTitle",
        parent=styles["Title"],
        alignment=TA_CENTER,
        fontSize=20,
        leading=26,
        textColor=colors.HexColor("#183153"),
        spaceAfter=8,
    )

    subtitle_style = ParagraphStyle(
        "SalarySlipSubtitle",
        parent=styles["Normal"],
        alignment=TA_CENTER,
        fontSize=10,
        textColor=colors.HexColor("#526174"),
        spaceAfter=18,
    )

    heading_style = ParagraphStyle(
        "SalarySectionHeading",
        parent=styles["Heading2"],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#183153"),
        spaceBefore=8,
        spaceAfter=8,
    )

    story = []

    salary_month = date(
        int(payroll.year),
        int(payroll.month),
        1,
    ).strftime("%B %Y")

    story.append(
        Paragraph("WORKSPHERE", title_style)
    )

    story.append(
        Paragraph("EMPLOYEE SALARY SLIP", subtitle_style)
    )

    employee_data = [
        [
            Paragraph("<b>Employee Name</b>", styles["Normal"]),
            employee.full_name,
            Paragraph("<b>Employee Code</b>", styles["Normal"]),
            employee.employee_code,
        ],
        [
            Paragraph("<b>Department</b>", styles["Normal"]),
            employee.department,
            Paragraph("<b>Designation</b>", styles["Normal"]),
            employee.designation,
        ],
        [
            Paragraph("<b>Salary Period</b>", styles["Normal"]),
            salary_month,
            Paragraph("<b>Payroll ID</b>", styles["Normal"]),
            str(payroll.id),
        ],
        [
            Paragraph("<b>Payment Status</b>", styles["Normal"]),
            payroll.status,
            Paragraph("<b>Payment Date</b>", styles["Normal"]),
            str(payroll.payment_date or "Not paid"),
        ],
    ]

    employee_table = Table(
        employee_data,
        colWidths=[32 * mm, 53 * mm, 32 * mm, 43 * mm],
    )

    employee_table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    colors.HexColor("#F3F6FA"),
                ),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#D7DFEA")),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D7DFEA")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )

    story.append(employee_table)
    story.append(Spacer(1, 10 * mm))

    story.append(
        Paragraph("Earnings", heading_style)
    )

    earnings_data = [
        ["Salary Component", "Amount"],
        ["Basic Salary", format_currency(payroll.basic_salary)],
        ["House Rent Allowance (HRA)", format_currency(payroll.hra)],
        ["Dearness Allowance (DA)", format_currency(payroll.da)],
        ["Other Allowances", format_currency(payroll.other_allowances)],
        ["Gross Salary", format_currency(payroll.gross_salary)],
    ]

    earnings_table = Table(
        earnings_data,
        colWidths=[105 * mm, 55 * mm],
    )

    earnings_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#183153")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#E7F4EC")),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("ALIGN", (1, 1), (1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D7DFEA")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )

    story.append(earnings_table)
    story.append(Spacer(1, 5 * mm))

    story.append(
        Paragraph("Deductions", heading_style)
    )

    deductions_data = [
        ["Deduction Component", "Amount"],
        ["Provident Fund (PF)", format_currency(payroll.pf_deduction)],
        ["Tax Deduction", format_currency(payroll.tax_deduction)],
        ["Other Deductions", format_currency(payroll.other_deductions)],
        ["Total Deductions", format_currency(payroll.total_deductions)],
    ]

    deductions_table = Table(
        deductions_data,
        colWidths=[105 * mm, 55 * mm],
    )

    deductions_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#183153")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#FCECEC")),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("ALIGN", (1, 1), (1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D7DFEA")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )

    story.append(deductions_table)
    story.append(Spacer(1, 8 * mm))

    net_data = [
        ["NET SALARY", format_currency(payroll.net_salary)]
    ]

    net_table = Table(
        net_data,
        colWidths=[105 * mm, 55 * mm],
    )

    net_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#183153")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 14),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )

    story.append(net_table)
    story.append(Spacer(1, 12 * mm))

    story.append(
        Paragraph(
            "This is a system-generated salary slip.",
            ParagraphStyle(
                "Footer",
                parent=styles["Normal"],
                alignment=TA_CENTER,
                fontSize=9,
                textColor=colors.HexColor("#64748B"),
            ),
        )
    )

    document.build(story)

    buffer.seek(0)

    return buffer


# =====================================================
# DOWNLOAD MY SALARY SLIP
# EMPLOYEE ONLY
# =====================================================

@router.get("/payroll/my/{payroll_id}/salary-slip")
def download_my_salary_slip(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("EMPLOYEE")
    ),
):
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == current_user.id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="No employee profile is linked to this account.",
        )

    payroll = (
        db.query(Payroll)
        .filter(
            Payroll.id == payroll_id,
            Payroll.employee_id == employee.id,
        )
        .first()
    )

    if payroll is None:
        raise HTTPException(
            status_code=404,
            detail="Payroll record not found.",
        )

    pdf_buffer = build_salary_slip(employee, payroll)

    filename = (
        f"salary_slip_{employee.employee_code}_"
        f"{payroll.year}_{payroll.month:02d}.pdf"
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            )
        },
    )


# =====================================================
# DOWNLOAD EMPLOYEE SALARY SLIP
# HR / ADMIN ONLY
# =====================================================

@router.get("/payroll/{payroll_id}/salary-slip")
def download_employee_salary_slip(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    payroll = (
        db.query(Payroll)
        .filter(Payroll.id == payroll_id)
        .first()
    )

    if payroll is None:
        raise HTTPException(
            status_code=404,
            detail="Payroll record not found.",
        )

    employee = (
        db.query(Employee)
        .filter(Employee.id == payroll.employee_id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Employee not found.",
        )

    pdf_buffer = build_salary_slip(employee, payroll)

    filename = (
        f"salary_slip_{employee.employee_code}_"
        f"{payroll.year}_{payroll.month:02d}.pdf"
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            )
        },
    )

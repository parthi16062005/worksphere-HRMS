
// ==========================================
// MODULE 25: GOOGLE CALENDAR ICS EXPORT
// ==========================================

function escapeICSText(value = "") {
    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
}

// Convert a date string to ICS format: YYYYMMDD.
function formatICSDate(dateString) {
    return String(dateString).replace(/-/g, "");
}

// Fold long ICS lines according to the calendar format.
function foldICSLine(line) {
    const chunks = [];
    let currentChunk = "";
    let currentLength = 0;

    for (const character of line) {
        const characterLength = new TextEncoder().encode(character).length;

        if (currentLength + characterLength > 73) {
            chunks.push(currentChunk);
            currentChunk = " " + character;
            currentLength = 1 + characterLength;
        } else {
            currentChunk += character;
            currentLength += characterLength;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks.join("\r\n");
}

// Download approved leave records as an ICS calendar file.
export function downloadLeaveCalendar(calendarItems = []) {
    if (!Array.isArray(calendarItems) || calendarItems.length === 0) {
        throw new Error("No leave events available to export.");
    }

    const events = calendarItems.map((leave, index) => {
        if (!leave.start_date || !leave.end_date) {
            throw new Error(
                "A leave record is missing its start or end date."
            );
        }

        const startDate = formatICSDate(leave.start_date);

        // ICS DTEND is exclusive for all-day events.
        const endDateObject = new Date(
            `${leave.end_date}T12:00:00`
        );

        if (Number.isNaN(endDateObject.getTime())) {
            throw new Error("A leave record contains an invalid date.");
        }

        endDateObject.setDate(endDateObject.getDate() + 1);

        const endDate = [
            endDateObject.getFullYear(),
            String(endDateObject.getMonth() + 1).padStart(2, "0"),
            String(endDateObject.getDate()).padStart(2, "0"),
        ].join("");

        const employeeName =
            leave.employee_name || "Employee";

        const leaveType =
            leave.leave_type || "Leave";

        const summary = `${employeeName} - ${leaveType} Leave`;

        const description = [
            `Employee: ${employeeName}`,
            `Department: ${leave.department || "Not specified"}`,
            `Employee Code: ${leave.employee_code || "Not specified"}`,
            `Leave Type: ${leaveType}`,
        ].join("\n");

        const uid =
            `worksphere-leave-${leave.leave_id ?? index}` +
            "@worksphere.local";

        return [
            "BEGIN:VEVENT",
            `UID:${uid}`,
            `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
            `DTSTART;VALUE=DATE:${startDate}`,
            `DTEND;VALUE=DATE:${endDate}`,
            `SUMMARY:${escapeICSText(summary)}`,
            `DESCRIPTION:${escapeICSText(description)}`,
            "STATUS:CONFIRMED",
            "END:VEVENT",
        ];
    });

    const calendarLines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//WorkSphere//Leave Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:WorkSphere Leave Calendar",
        ...events.flat(),
        "END:VCALENDAR",
    ];

    const icsContent =
        calendarLines.map(foldICSLine).join("\r\n") + "\r\n";

    const blob = new Blob(
        [icsContent],
        { type: "text/calendar;charset=utf-8" }
    );

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = "worksphere_leave_calendar.ics";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
    }, 1000);
}

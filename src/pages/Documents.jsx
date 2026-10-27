
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

import "../style/Documents.css";

const API_BASE_URL = "http://127.0.0.1:8000";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
    ".pdf",
    ".doc",
    ".docx",
    ".jpg",
    ".jpeg",
    ".png",
    ".txt",
];

function Documents({ user }) {
    const [documents, setDocuments] = useState([]);
    const [employees, setEmployees] = useState([]);

    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedEmployee, setSelectedEmployee] = useState("");

    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("ALL");

    const [message, setMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const fileInputRef = useRef(null);

    const role = String(user?.role || "").toUpperCase();

    const isAdminOrHR =
        role === "ADMIN" || role === "HR";

    const token = localStorage.getItem("worksphere_token");

    const api = axios.create({
        baseURL: API_BASE_URL,
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    // ==========================================
    // ERROR MESSAGE HELPER
    // ==========================================

    const getErrorMessage = (error) => {
        const detail = error.response?.data?.detail;

        if (typeof detail === "string") {
            return detail;
        }

        if (Array.isArray(detail)) {
            return detail
                .map((item) => item.msg || "Invalid input")
                .join(", ");
        }

        return error.message || "Something went wrong.";
    };

    // ==========================================
    // LOAD DOCUMENTS
    // ==========================================

    const loadDocuments = useCallback(async () => {
        setLoading(true);
        setErrorMessage("");

        try {
            const response = await api.get("/documents");

            const data = response.data;

            setDocuments(
                Array.isArray(data)
                    ? data
                    : data.documents || []
            );
        } catch (error) {
            console.error(
                "Unable to load documents:",
                error.response?.data || error.message
            );

            setErrorMessage(
                getErrorMessage(error)
            );
        } finally {
            setLoading(false);
        }
    }, [token]);

    // ==========================================
    // LOAD EMPLOYEES FOR HR / ADMIN
    // ==========================================

    const loadEmployees = useCallback(async () => {
        if (!isAdminOrHR) {
            setEmployees([]);
            return;
        }

        try {
            const response = await api.get("/employees");

            const data = response.data;

            setEmployees(
                Array.isArray(data)
                    ? data
                    : data.employees || []
            );
        } catch (error) {
            console.error(
                "Unable to load employees:",
                error.response?.data || error.message
            );
        }
    }, [token, isAdminOrHR]);

    // ==========================================
    // INITIAL LOAD
    // ==========================================

    useEffect(() => {
        loadDocuments();
        loadEmployees();
    }, [loadDocuments, loadEmployees]);

    // ==========================================
    // FILE SELECTION
    // ==========================================

    const handleFileChange = (event) => {
        setMessage("");
        setErrorMessage("");

        const file = event.target.files?.[0];

        if (!file) {
            setSelectedFile(null);
            return;
        }

        const extension = file.name
            .slice(file.name.lastIndexOf("."))
            .toLowerCase();

        if (!ALLOWED_EXTENSIONS.includes(extension)) {
            setSelectedFile(null);

            setErrorMessage(
                "Unsupported file type. Upload PDF, DOC, DOCX, JPG, JPEG, PNG, or TXT files."
            );

            event.target.value = "";
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setSelectedFile(null);

            setErrorMessage(
                "File size cannot exceed 10 MB."
            );

            event.target.value = "";
            return;
        }

        setSelectedFile(file);
    };

    // ==========================================
    // UPLOAD DOCUMENT
    // ==========================================

    const handleUpload = async (event) => {
        event.preventDefault();

        setMessage("");
        setErrorMessage("");

        if (!selectedFile) {
            setErrorMessage("Please select a document.");
            return;
        }

        if (isAdminOrHR && !selectedEmployee) {
            setErrorMessage(
                "Please select an employee for this document."
            );
            return;
        }

        const formData = new FormData();

        formData.append("file", selectedFile);

        if (isAdminOrHR) {
            formData.append(
                "employee_id",
                selectedEmployee
            );
        }

        setUploading(true);

        try {
            await api.post(
                "/documents/upload",
                formData
            );

            setMessage(
                "Document uploaded successfully."
            );

            setSelectedFile(null);
            setSelectedEmployee("");

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }

            await loadDocuments();
        } catch (error) {
            console.error(
                "Document upload failed:",
                error.response?.data || error.message
            );

            setErrorMessage(
                getErrorMessage(error)
            );
        } finally {
            setUploading(false);
        }
    };

    // ==========================================
    // DOWNLOAD DOCUMENT
    // ==========================================

    const handleDownload = async (documentItem) => {
        setMessage("");
        setErrorMessage("");

        setDownloadingId(documentItem.id);

        try {
            const response = await api.get(
                `/documents/${documentItem.id}/download`,
                {
                    responseType: "blob",
                }
            );

            const blobUrl = window.URL.createObjectURL(
                response.data
            );

            const link = document.createElement("a");

            link.href = blobUrl;
            link.download =
                documentItem.file_name || "document";

            document.body.appendChild(link);
            link.click();
            link.remove();

            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error(
                "Document download failed:",
                error
            );

            setErrorMessage(
                "Unable to download this document. Please try again."
            );
        } finally {
            setDownloadingId(null);
        }
    };

    // ==========================================
    // DELETE DOCUMENT
    // ==========================================

    const handleDelete = async (documentItem) => {
        const confirmed = window.confirm(
            `Are you sure you want to delete "${documentItem.file_name}"?`
        );

        if (!confirmed) {
            return;
        }

        setMessage("");
        setErrorMessage("");
        setDeletingId(documentItem.id);

        try {
            await api.delete(
                `/documents/${documentItem.id}`
            );

            setDocuments((previous) =>
                previous.filter(
                    (item) => item.id !== documentItem.id
                )
            );

            setMessage(
                "Document deleted successfully."
            );
        } catch (error) {
            console.error(
                "Document deletion failed:",
                error.response?.data || error.message
            );

            setErrorMessage(
                getErrorMessage(error)
            );
        } finally {
            setDeletingId(null);
        }
    };

    // ==========================================
    // FORMAT HELPERS
    // ==========================================

    const formatDate = (value) => {
        if (!value) {
            return "—";
        }

        const parsedDate = new Date(value);

        if (Number.isNaN(parsedDate.getTime())) {
            return value;
        }

        return parsedDate.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getFileExtension = (fileName = "") => {
        const parts = fileName.split(".");

        return parts.length > 1
            ? parts.pop().toUpperCase()
            : "FILE";
    };

    const getEmployeeName = (documentItem) => {
        if (documentItem.employee_name) {
            return documentItem.employee_name;
        }

        const employeeId =
            documentItem.employee_id;

        const employee = employees.find(
            (item) => item.id === employeeId
        );

        if (employee) {
            return (
                employee.full_name ||
                employee.name ||
                employee.employee_code ||
                `Employee #${employee.id}`
            );
        }

        return employeeId
            ? `Employee #${employeeId}`
            : "—";
    };

    // ==========================================
    // SEARCH AND FILTER
    // ==========================================

    const filteredDocuments = documents.filter(
        (documentItem) => {
            const fileName = String(
                documentItem.file_name || ""
            ).toLowerCase();

            const employeeName = getEmployeeName(
                documentItem
            ).toLowerCase();

            const query = searchTerm.toLowerCase();

            const matchesSearch =
                fileName.includes(query) ||
                employeeName.includes(query);

            const extension = getFileExtension(
                documentItem.file_name
            );

            const matchesType =
                filterType === "ALL" ||
                extension === filterType;

            return matchesSearch && matchesType;
        }
    );

    const documentTypes = [
        ...new Set(
            documents.map((item) =>
                getFileExtension(item.file_name)
            )
        ),
    ].sort();

    // ==========================================
    // SUMMARY COUNTS
    // ==========================================

    const totalDocuments = documents.length;

    const pdfCount = documents.filter(
        (item) =>
            getFileExtension(item.file_name) === "PDF"
    ).length;

    const wordCount = documents.filter((item) =>
        ["DOC", "DOCX"].includes(
            getFileExtension(item.file_name)
        )
    ).length;

    const imageCount = documents.filter((item) =>
        ["JPG", "JPEG", "PNG"].includes(
            getFileExtension(item.file_name)
        )
    ).length;

    // ==========================================
    // RENDER
    // ==========================================

    return (
        <div className="documents-page">

            {/* PAGE INTRODUCTION */}

            <section className="documents-hero">
                <div>
                    <span className="documents-eyebrow">
                        WORKSPHERE / MODULE 16
                    </span>

                    <h2>Document Management</h2>

                    <p>
                        Securely upload, organize, and download
                        employee documents from one place.
                    </p>
                </div>

                <div className="documents-hero-icon">
                    DOC
                </div>
            </section>

            {/* STATUS MESSAGES */}

            {message && (
                <div
                    className="documents-alert documents-alert-success"
                    role="status"
                >
                    {message}
                </div>
            )}

            {errorMessage && (
                <div
                    className="documents-alert documents-alert-error"
                    role="alert"
                >
                    {errorMessage}
                </div>
            )}

            {/* SUMMARY CARDS */}

            <section className="documents-stats">
                <article className="documents-stat-card">
                    <div className="documents-stat-icon">
                        ALL
                    </div>

                    <div>
                        <span>Total Documents</span>
                        <strong>{totalDocuments}</strong>
                    </div>
                </article>

                <article className="documents-stat-card">
                    <div className="documents-stat-icon">
                        PDF
                    </div>

                    <div>
                        <span>PDF Files</span>
                        <strong>{pdfCount}</strong>
                    </div>
                </article>

                <article className="documents-stat-card">
                    <div className="documents-stat-icon">
                        DOC
                    </div>

                    <div>
                        <span>Word Documents</span>
                        <strong>{wordCount}</strong>
                    </div>
                </article>

                <article className="documents-stat-card">
                    <div className="documents-stat-icon">
                        IMG
                    </div>

                    <div>
                        <span>Images</span>
                        <strong>{imageCount}</strong>
                    </div>
                </article>
            </section>

            {/* UPLOAD SECTION */}

            <section className="documents-panel">
                <div className="documents-section-heading">
                    <div>
                        <h3>Upload a Document</h3>

                        <p>
                            Supported formats: PDF, DOC, DOCX,
                            JPG, JPEG, PNG, TXT. Maximum size: 10 MB.
                        </p>
                    </div>
                </div>

                <form
                    className="documents-upload-form"
                    onSubmit={handleUpload}
                >
                    {isAdminOrHR && (
                        <div className="documents-form-group">
                            <label htmlFor="document-employee">
                                Select Employee
                            </label>

                            <select
                                id="document-employee"
                                value={selectedEmployee}
                                onChange={(event) =>
                                    setSelectedEmployee(
                                        event.target.value
                                    )
                                }
                                required
                            >
                                <option value="">
                                    Choose an employee
                                </option>

                                {employees.map((employee) => (
                                    <option
                                        key={employee.id}
                                        value={employee.id}
                                    >
                                        {employee.full_name ||
                                            employee.name ||
                                            employee.employee_code ||
                                            `Employee #${employee.id}`}
                                        {employee.employee_code
                                            ? ` (${employee.employee_code})`
                                            : ""}
                                    </option>
                                ))}
                            </select>

                            {employees.length === 0 && (
                                <small>
                                    No employees loaded. Check your
                                    employee API and active employee records.
                                </small>
                            )}
                        </div>
                    )}

                    <div className="documents-form-group">
                        <label htmlFor="document-file">
                            Choose Document
                        </label>

                        <input
                            ref={fileInputRef}
                            id="document-file"
                            type="file"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                            onChange={handleFileChange}
                            required
                        />

                        {selectedFile && (
                            <div className="documents-selected-file">
                                <span>
                                    {selectedFile.name}
                                </span>

                                <small>
                                    {(
                                        selectedFile.size /
                                        (1024 * 1024)
                                    ).toFixed(2)}{" "}
                                    MB
                                </small>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="documents-primary-button"
                        disabled={uploading}
                    >
                        {uploading
                            ? "Uploading..."
                            : "Upload Document"}
                    </button>
                </form>
            </section>

            {/* DOCUMENT LIST */}

            <section className="documents-panel">
                <div className="documents-section-heading">
                    <div>
                        <h3>Document Library</h3>

                        <p>
                            {isAdminOrHR
                                ? "Manage employee documents according to your access permissions."
                                : "View and download documents belonging to your employee account."}
                        </p>
                    </div>

                    <button
                        type="button"
                        className="documents-secondary-button"
                        onClick={() => {
                            loadDocuments();
                            loadEmployees();
                        }}
                        disabled={loading}
                    >
                        {loading ? "Refreshing..." : "Refresh"}
                    </button>
                </div>

                {/* SEARCH AND FILTER */}

                <div className="documents-toolbar">
                    <div className="documents-search">
                        <label htmlFor="document-search">
                            Search documents
                        </label>

                        <input
                            id="document-search"
                            type="search"
                            placeholder="Search by file name..."
                            value={searchTerm}
                            onChange={(event) =>
                                setSearchTerm(event.target.value)
                            }
                        />
                    </div>

                    <div className="documents-filter">
                        <label htmlFor="document-type-filter">
                            File Type
                        </label>

                        <select
                            id="document-type-filter"
                            value={filterType}
                            onChange={(event) =>
                                setFilterType(event.target.value)
                            }
                        >
                            <option value="ALL">
                                All Types
                            </option>

                            {documentTypes.map((type) => (
                                <option
                                    key={type}
                                    value={type}
                                >
                                    {type}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* TABLE */}

                {loading ? (
                    <div className="documents-state">
                        <div className="documents-spinner"></div>

                        <p>Loading documents...</p>
                    </div>
                ) : errorMessage && documents.length === 0 ? (
                    <div className="documents-state">
                        <h4>Unable to load documents</h4>

                        <p>
                            Check the backend connection and your
                            account permissions, then try refreshing.
                        </p>

                        <button
                            type="button"
                            className="documents-secondary-button"
                            onClick={loadDocuments}
                        >
                            Try Again
                        </button>
                    </div>
                ) : filteredDocuments.length === 0 ? (
                    <div className="documents-state">
                        <div className="documents-empty-icon">
                            DOC
                        </div>

                        <h4>
                            {documents.length === 0
                                ? "No documents uploaded yet"
                                : "No matching documents"}
                        </h4>

                        <p>
                            {documents.length === 0
                                ? "Upload a document to get started."
                                : "Try changing your search or file type filter."}
                        </p>
                    </div>
                ) : (
                    <div className="documents-table-wrapper">
                        <table className="documents-table">
                            <thead>
                                <tr>
                                    <th>Document</th>

                                    {isAdminOrHR && (
                                        <th>Employee</th>
                                    )}

                                    <th>Uploaded At</th>
                                    <th>File Type</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredDocuments.map(
                                    (documentItem) => (
                                        <tr key={documentItem.id}>
                                            <td>
                                                <div className="documents-file-cell">
                                                    <div className="documents-file-icon">
                                                        {getFileExtension(
                                                            documentItem.file_name
                                                        )}
                                                    </div>

                                                    <div className="documents-file-details">
                                                        <strong>
                                                            {documentItem.file_name}
                                                        </strong>

                                                        <span>
                                                            Document ID:{" "}
                                                            {documentItem.id}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {isAdminOrHR && (
                                                <td>
                                                    <div className="documents-employee-cell">
                                                        <strong>
                                                            {getEmployeeName(
                                                                documentItem
                                                            )}
                                                        </strong>

                                                        <span>
                                                            Employee ID:{" "}
                                                            {documentItem.employee_id}
                                                        </span>
                                                    </div>
                                                </td>
                                            )}

                                            <td>
                                                {formatDate(
                                                    documentItem.uploaded_at
                                                )}
                                            </td>

                                            <td>
                                                <span className="documents-type-badge">
                                                    {getFileExtension(
                                                        documentItem.file_name
                                                    )}
                                                </span>
                                            </td>

                                            <td>
                                                <div className="documents-actions">
                                                    <button
                                                        type="button"
                                                        className="documents-download-button"
                                                        onClick={() =>
                                                            handleDownload(
                                                                documentItem
                                                            )
                                                        }
                                                        disabled={
                                                            downloadingId ===
                                                            documentItem.id
                                                        }
                                                    >
                                                        {downloadingId ===
                                                        documentItem.id
                                                            ? "Downloading..."
                                                            : "Download"}
                                                    </button>

                                                    {isAdminOrHR && (
                                                        <button
                                                            type="button"
                                                            className="documents-delete-button"
                                                            onClick={() =>
                                                                handleDelete(
                                                                    documentItem
                                                                )
                                                            }
                                                            disabled={
                                                                deletingId ===
                                                                documentItem.id
                                                            }
                                                        >
                                                            {deletingId ===
                                                            documentItem.id
                                                                ? "Deleting..."
                                                                : "Delete"}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* TABLE FOOTER */}

                {!loading &&
                    filteredDocuments.length > 0 && (
                        <div className="documents-table-footer">
                            Showing {filteredDocuments.length} of{" "}
                            {documents.length} documents
                        </div>
                    )}
            </section>
        </div>
    );
}

export default Documents;

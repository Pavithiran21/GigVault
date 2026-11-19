import io
import zipfile

PDF = "application/pdf"
PNG = "image/png"
JPEG = "image/jpeg"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def detect_content_type(content: bytes) -> str | None:
    """
    Works out the real type from the file's first bytes (its "magic number"), never from the
    name or the Content-Type header, which the sender controls. Returns None for anything else.
    """
    head = content[:8]
    if head.startswith(b"%PDF-"):
        return PDF
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return PNG
    if head.startswith(b"\xff\xd8\xff"):
        return JPEG
    if head.startswith(b"PK\x03\x04") and _is_docx(content):
        return DOCX
    return None


def _is_docx(content: bytes) -> bool:
    # A DOCX is a ZIP archive with a Word document inside. Only the list of names is read,
    # nothing is unpacked, so a "zip bomb" can't fill memory.
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            names = set(archive.namelist())
        return "[Content_Types].xml" in names and "word/document.xml" in names
    except zipfile.BadZipFile:
        return False

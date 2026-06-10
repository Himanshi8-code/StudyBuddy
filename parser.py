# parser.py — Extract text from uploaded files
import os

def extract_text(file_path, original_name):
    ext = os.path.splitext(original_name)[1].lower()
    try:
        if ext == '.pdf':
            import fitz  # PyMuPDF
            doc = fitz.open(file_path)
            return '\n'.join(page.get_text() for page in doc)

        elif ext == '.docx':
            from docx import Document
            doc = Document(file_path)
            return '\n'.join(p.text for p in doc.paragraphs if p.text.strip())

        elif ext in ('.txt', '.md'):
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()

        return None
    except Exception as e:
        print(f'Parse error ({original_name}): {e}')
        return None

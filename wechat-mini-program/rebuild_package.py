from pathlib import Path
import base64

root = Path(__file__).resolve().parent
parts = sorted(root.glob("source-v1.0.7.zip.b64.*"))
if not parts:
    raise SystemExit("No package parts found")

data = base64.b64decode("".join(p.read_text().strip() for p in parts))
out = root / "source-v1.0.7.zip"
out.write_bytes(data)
print(f"Created {out} ({len(data)} bytes)")

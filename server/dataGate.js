// Allowlist gate for everything served under /data.
//
// /data used to be a static view of the whole writable data folder, which
// also holds accounts/ (password hashes, login tokens), instances/<id>/
// config.json (classroom write tokens) and backups/. Anyone could download
// them. Now ONLY these shapes get through, everything else is a 404:
//   /data/(SOURCE_FILES|CLEAN_FILES)/<one file>.csv|.json
//   /data/<one file>.csv                          (dictionary GLOSSARY.csv)
//   /data/i/<classroom-id>/(SOURCE_FILES|CLEAN_FILES)/<one file>.csv|.json
// The path is decoded first, so %2e%2e, %2F and backslash tricks are judged
// by what they really mean, and any dot-leading or odd segment is refused.

const BOARD_DIRS = new Set(['SOURCE_FILES', 'CLEAN_FILES']);
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9 ._()-]*\.(csv|json)$/;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function isAllowedDataPath(rawPath) {
  let p;
  try {
    p = decodeURIComponent(rawPath);
  } catch {
    return false;
  }
  if (/[\\0]/.test(p) || !p.startsWith('/')) return false;
  const parts = p.slice(1).split('/');
  if (parts.some((s) => s === '' || s.startsWith('.'))) return false;
  if (parts[0] === 'i') {
    if (parts.length !== 4) return false;
    return ID_RE.test(parts[1]) && BOARD_DIRS.has(parts[2]) && FILE_RE.test(parts[3]);
  }
  if (parts.length === 2) return BOARD_DIRS.has(parts[0]) && FILE_RE.test(parts[1]);
  if (parts.length === 1) return /\.csv$/.test(parts[0]) && FILE_RE.test(parts[0]);
  return false;
}

export function dataGate(req, res, next) {
  if (isAllowedDataPath(req.path)) return next();
  return res.status(404).end();
}

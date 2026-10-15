// ============================================================
// Google Apps Script source for the Drive sync bridge
// ============================================================
//
// The user pastes this into script.google.com and deploys it as a web app
// ("Execute as: Me", "Who has access: Anyone"). The app POSTs files to the
// /exec URL; the script writes them into a `my-workouts` folder in the
// user's Drive, where Claude's Drive connector can read them. The shared
// secret is baked in at copy time, and only the known file names below are
// ever read or written, so a leaked secret can't be used to stash other files.

import { DRIVE_FILES, DRIVE_FOLDER } from './driveFiles'

export function bridgeScript(secret: string): string {
  return `// my-workouts → Google Drive bridge. Deploy as a web app:
//   Deploy → New deployment → Web app
//   Execute as: Me · Who has access: Anyone
// To update later, use Manage deployments → Edit so the URL stays the same.

var SECRET = ${JSON.stringify(secret)};
var FOLDER = ${JSON.stringify(DRIVE_FOLDER)};
var FILES = ${JSON.stringify(DRIVE_FILES)};

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: "bad-request" });
  }
  if (!req || !safeEqual(req.secret, SECRET)) return reply({ ok: false, error: "auth" });

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var folder = getFolder();
    if (req.action === "write") {
      var names = Object.keys(req.files || {});
      for (var i = 0; i < names.length; i++) {
        if (FILES.indexOf(names[i]) < 0) return reply({ ok: false, error: "bad-file" });
      }
      for (var j = 0; j < names.length; j++) {
        writeFile(folder, names[j], String(req.files[names[j]]));
      }
      return reply({ ok: true, writtenAt: Date.now() });
    }
    if (req.action === "read") {
      if (FILES.indexOf(req.name) < 0) return reply({ ok: false, error: "bad-file" });
      var it = folder.getFilesByName(req.name);
      if (!it.hasNext()) return reply({ ok: false, error: "missing" });
      return reply({ ok: true, content: it.next().getBlob().getDataAsString() });
    }
    return reply({ ok: false, error: "bad-request" });
  } finally {
    lock.releaseLock();
  }
}

// Constant-time comparison so response timing can't reveal the secret.
function safeEqual(a, b) {
  if (typeof a !== "string" || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function getFolder() {
  var it = DriveApp.getFoldersByName(FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER);
}

function writeFile(folder, name, content) {
  var it = folder.getFilesByName(name);
  if (it.hasNext()) {
    it.next().setContent(content);
  } else {
    folder.createFile(name, content, mimeFor(name));
  }
}

function mimeFor(name) {
  if (/\\.json$/.test(name)) return "application/json";
  if (/\\.csv$/.test(name)) return "text/csv";
  return "text/plain";
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
`
}

export function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Workspace accounts deploy under /a/macros/<domain>/s/…/exec.
const EXEC_URL_RE = /^https:\/\/script\.google\.com\/(?:a\/macros\/[^/]+|macros)\/s\/[\w-]+\/exec$/

export function isBridgeUrl(url: string): boolean {
  return EXEC_URL_RE.test(url.trim())
}

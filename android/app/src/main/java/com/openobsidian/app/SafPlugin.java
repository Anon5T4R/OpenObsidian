package com.openobsidian.app;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;

import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "SafPlugin")
public class SafPlugin extends Plugin {

    // ── Folder picker ─────────────────────────────────────────────────────────

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION |
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION |
            Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
        );
        startActivityForResult(call, intent, "handlePickResult");
    }

    @ActivityCallback
    private void handlePickResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != android.app.Activity.RESULT_OK
                || result.getData() == null) {
            call.resolve(); // user cancelled
            return;
        }
        Uri treeUri = result.getData().getData();
        if (treeUri == null) { call.resolve(); return; }

        // Take permanent read+write permission
        int flags = Intent.FLAG_GRANT_READ_URI_PERMISSION
                  | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
        try {
            getContext().getContentResolver().takePersistableUriPermission(treeUri, flags);
        } catch (SecurityException e) {
            call.reject("Could not take persistent permission: " + e.getMessage());
            return;
        }

        DocumentFile root = DocumentFile.fromTreeUri(getContext(), treeUri);
        JSObject ret = new JSObject();
        ret.put("uri", treeUri.toString());
        ret.put("displayName", root != null && root.getName() != null ? root.getName() : "Unknown");
        call.resolve(ret);
    }

    // ── Navigation helpers ────────────────────────────────────────────────────

    /** Navigate to a child in the tree using a "/" separated relative path. */
    private DocumentFile navigateTo(Uri treeUri, String relPath) {
        DocumentFile node = DocumentFile.fromTreeUri(getContext(), treeUri);
        if (node == null) return null;
        if (relPath == null || relPath.isEmpty()) return node;

        for (String segment : relPath.split("/")) {
            if (segment.isEmpty()) continue;
            node = node.findFile(segment);
            if (node == null) return null;
        }
        return node;
    }

    /** Navigate, creating missing directories along the way. */
    private DocumentFile navigateOrCreate(Uri treeUri, String relPath) {
        DocumentFile node = DocumentFile.fromTreeUri(getContext(), treeUri);
        if (node == null) return null;
        if (relPath == null || relPath.isEmpty()) return node;

        String[] segments = relPath.split("/");
        for (int i = 0; i < segments.length; i++) {
            String seg = segments[i];
            if (seg.isEmpty()) continue;
            DocumentFile child = node.findFile(seg);
            if (child == null) {
                child = node.createDirectory(seg);
                if (child == null) return null;
            }
            node = child;
        }
        return node;
    }

    // ── File listing ──────────────────────────────────────────────────────────

    @PluginMethod
    public void listDir(PluginCall call) {
        String uriStr = call.getString("uri");
        String relPath = call.getString("path", "");
        if (uriStr == null) { call.reject("uri required"); return; }

        Uri treeUri = Uri.parse(uriStr);
        DocumentFile dir = navigateTo(treeUri, relPath);

        if (dir == null || !dir.isDirectory()) {
            call.reject("Directory not found: " + relPath);
            return;
        }

        // Use DocumentsContract query for efficiency (avoids per-file round trips)
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
            treeUri,
            DocumentsContract.getDocumentId(dir.getUri())
        );

        JSArray files = new JSArray();
        try (Cursor cursor = getContext().getContentResolver().query(
                childrenUri,
                new String[]{
                    DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                    DocumentsContract.Document.COLUMN_MIME_TYPE,
                    DocumentsContract.Document.COLUMN_LAST_MODIFIED,
                    DocumentsContract.Document.COLUMN_SIZE
                },
                null, null, null)) {
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    String name     = cursor.getString(0);
                    String mime     = cursor.getString(1);
                    long modified   = cursor.getLong(2);
                    long size       = cursor.getLong(3);
                    boolean isDir   = DocumentsContract.Document.MIME_TYPE_DIR.equals(mime);

                    JSObject entry = new JSObject();
                    entry.put("name", name);
                    entry.put("isDirectory", isDir);
                    entry.put("lastModified", modified);
                    entry.put("size", size);
                    files.put(entry);
                }
            }
        } catch (Exception e) {
            call.reject("listDir failed: " + e.getMessage());
            return;
        }

        JSObject ret = new JSObject();
        ret.put("files", files);
        call.resolve(ret);
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    @PluginMethod
    public void readFile(PluginCall call) {
        String uriStr  = call.getString("uri");
        String relPath = call.getString("path", "");
        if (uriStr == null) { call.reject("uri required"); return; }

        DocumentFile file = navigateTo(Uri.parse(uriStr), relPath);
        if (file == null || !file.isFile()) {
            call.reject("File not found: " + relPath);
            return;
        }

        try (InputStream is = getContext().getContentResolver().openInputStream(file.getUri())) {
            if (is == null) { call.reject("Cannot open stream"); return; }
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) != -1) baos.write(buf, 0, n);
            JSObject ret = new JSObject();
            ret.put("data", baos.toString("UTF-8"));
            call.resolve(ret);
        } catch (IOException e) {
            call.reject("readFile failed: " + e.getMessage());
        }
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    @PluginMethod
    public void writeFile(PluginCall call) {
        String uriStr  = call.getString("uri");
        String relPath = call.getString("path", "");
        String data    = call.getString("data", "");
        if (uriStr == null) { call.reject("uri required"); return; }

        Uri treeUri = Uri.parse(uriStr);
        String parentRel = parentPath(relPath);
        String fileName  = lastName(relPath);

        DocumentFile parent = parentRel.isEmpty()
            ? DocumentFile.fromTreeUri(getContext(), treeUri)
            : navigateOrCreate(treeUri, parentRel);

        if (parent == null) { call.reject("Cannot create parent directories"); return; }

        DocumentFile file = parent.findFile(fileName);
        if (file == null) {
            file = parent.createFile("text/plain", fileName);
        }
        if (file == null) { call.reject("Cannot create file: " + relPath); return; }

        // "wt" = write + truncate; fall back to "w" for providers that don't support "wt"
        try (OutputStream os = getContext().getContentResolver()
                .openOutputStream(file.getUri(), "wt")) {
            if (os == null) throw new IOException("null stream");
            os.write(data.getBytes(StandardCharsets.UTF_8));
            call.resolve();
        } catch (IOException e) {
            // Fallback: delete and recreate
            try {
                file.delete();
                DocumentFile newFile = parent.createFile("text/plain", fileName);
                if (newFile == null) throw new IOException("recreate failed");
                try (OutputStream os2 = getContext().getContentResolver()
                        .openOutputStream(newFile.getUri())) {
                    if (os2 == null) throw new IOException("null stream");
                    os2.write(data.getBytes(StandardCharsets.UTF_8));
                }
                call.resolve();
            } catch (IOException ex) {
                call.reject("writeFile failed: " + ex.getMessage());
            }
        }
    }

    // ── Stat ──────────────────────────────────────────────────────────────────

    @PluginMethod
    public void stat(PluginCall call) {
        String uriStr  = call.getString("uri");
        String relPath = call.getString("path", "");
        if (uriStr == null) { call.reject("uri required"); return; }

        DocumentFile f = navigateTo(Uri.parse(uriStr), relPath);
        JSObject ret = new JSObject();
        if (f == null || !f.exists()) {
            ret.put("exists", false);
        } else {
            ret.put("exists", true);
            ret.put("isDirectory", f.isDirectory());
            ret.put("lastModified", f.lastModified());
            ret.put("size", f.length());
        }
        call.resolve(ret);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    @PluginMethod
    public void deleteEntry(PluginCall call) {
        String uriStr  = call.getString("uri");
        String relPath = call.getString("path", "");
        if (uriStr == null) { call.reject("uri required"); return; }

        DocumentFile f = navigateTo(Uri.parse(uriStr), relPath);
        if (f == null || !f.exists()) { call.resolve(); return; }

        if (f.delete()) {
            call.resolve();
        } else {
            call.reject("Delete failed: " + relPath);
        }
    }

    // ── Rename (in-place) ─────────────────────────────────────────────────────

    @PluginMethod
    public void renameEntry(PluginCall call) {
        String uriStr   = call.getString("uri");
        String relPath  = call.getString("path", "");
        String newName  = call.getString("newName");
        if (uriStr == null || newName == null) { call.reject("uri and newName required"); return; }

        DocumentFile f = navigateTo(Uri.parse(uriStr), relPath);
        if (f == null || !f.exists()) { call.reject("Not found: " + relPath); return; }

        if (f.renameTo(newName)) {
            String parent = parentPath(relPath);
            String newPath = parent.isEmpty() ? newName : parent + "/" + newName;
            JSObject ret = new JSObject();
            ret.put("newPath", newPath);
            call.resolve(ret);
        } else {
            call.reject("Rename failed: " + relPath);
        }
    }

    // ── Mkdir ─────────────────────────────────────────────────────────────────

    @PluginMethod
    public void mkdir(PluginCall call) {
        String uriStr  = call.getString("uri");
        String relPath = call.getString("path", "");
        if (uriStr == null) { call.reject("uri required"); return; }

        Uri treeUri = Uri.parse(uriStr);
        String parent  = parentPath(relPath);
        String dirName = lastName(relPath);

        DocumentFile parentDir = parent.isEmpty()
            ? DocumentFile.fromTreeUri(getContext(), treeUri)
            : navigateOrCreate(treeUri, parent);

        if (parentDir == null) { call.reject("Cannot navigate to parent"); return; }

        DocumentFile existing = parentDir.findFile(dirName);
        if (existing != null && existing.isDirectory()) { call.resolve(); return; }

        DocumentFile created = parentDir.createDirectory(dirName);
        if (created != null) {
            call.resolve();
        } else {
            call.reject("mkdir failed: " + relPath);
        }
    }

    // ── Copy file (for duplicate / move) ──────────────────────────────────────

    @PluginMethod
    public void copyFile(PluginCall call) {
        String uriStr    = call.getString("uri");
        String fromPath  = call.getString("from", "");
        String toPath    = call.getString("to", "");
        if (uriStr == null) { call.reject("uri required"); return; }

        Uri treeUri = Uri.parse(uriStr);
        DocumentFile src = navigateTo(treeUri, fromPath);
        if (src == null || !src.isFile()) { call.reject("Source not found: " + fromPath); return; }

        String destParent = parentPath(toPath);
        String destName   = lastName(toPath);
        DocumentFile dstDir = destParent.isEmpty()
            ? DocumentFile.fromTreeUri(getContext(), treeUri)
            : navigateOrCreate(treeUri, destParent);

        if (dstDir == null) { call.reject("Cannot create destination directory"); return; }

        String mime = src.getType();
        if (mime == null) mime = "text/plain";
        DocumentFile dstFile = dstDir.createFile(mime, destName);
        if (dstFile == null) { call.reject("Cannot create destination file"); return; }

        try (InputStream is = getContext().getContentResolver().openInputStream(src.getUri());
             OutputStream os = getContext().getContentResolver().openOutputStream(dstFile.getUri())) {
            if (is == null || os == null) throw new IOException("null stream");
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) != -1) os.write(buf, 0, n);
            call.resolve();
        } catch (IOException e) {
            dstFile.delete();
            call.reject("copyFile failed: " + e.getMessage());
        }
    }

    // ── Path utilities ────────────────────────────────────────────────────────

    private static String parentPath(String path) {
        int idx = path.lastIndexOf('/');
        return idx > 0 ? path.substring(0, idx) : "";
    }

    private static String lastName(String path) {
        int idx = path.lastIndexOf('/');
        return idx >= 0 ? path.substring(idx + 1) : path;
    }
}

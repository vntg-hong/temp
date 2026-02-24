package com.hong.currencycalc;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "FileDownload")
public class FileDownloadPlugin extends Plugin {

    /**
     * Android 10+ (API 29+): MediaStore.Downloads API 사용 (권한 불필요)
     * Android 9-  (API 28-): 직접 파일 쓰기 (WRITE_EXTERNAL_STORAGE 권한 필요)
     */
    @PluginMethod
    public void writeToDownloads(PluginCall call) {
        String filename  = call.getString("filename");
        String data      = call.getString("data");
        String subfolder = call.getString("subfolder", "");

        if (filename == null || data == null) {
            call.reject("filename and data are required");
            return;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // ── Android 10+ ──────────────────────────────────────────────
                // MediaStore.Downloads API: 퍼미션 없이 Download 폴더 직접 저장
                String relativePath = (subfolder != null && !subfolder.isEmpty())
                        ? "Download/" + subfolder + "/"
                        : "Download/";

                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                values.put(MediaStore.Downloads.MIME_TYPE, "application/json");
                values.put(MediaStore.Downloads.RELATIVE_PATH, relativePath);

                Uri uri = getContext().getContentResolver().insert(
                        MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);

                if (uri == null) {
                    call.reject("MediaStore: Failed to create file entry");
                    return;
                }

                try (OutputStream os = getContext().getContentResolver().openOutputStream(uri)) {
                    if (os == null) {
                        call.reject("MediaStore: Failed to open output stream");
                        return;
                    }
                    os.write(data.getBytes("UTF-8"));
                    os.flush();
                }

                JSObject result = new JSObject();
                result.put("uri", uri.toString());
                call.resolve(result);

            } else {
                // ── Android 9 이하 ───────────────────────────────────────────
                // WRITE_EXTERNAL_STORAGE 권한으로 직접 파일 쓰기
                File downloadsDir = Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_DOWNLOADS);

                File targetDir = (subfolder != null && !subfolder.isEmpty())
                        ? new File(downloadsDir, subfolder)
                        : downloadsDir;

                if (!targetDir.exists() && !targetDir.mkdirs()) {
                    call.reject("Legacy: Failed to create directory " + targetDir.getAbsolutePath());
                    return;
                }

                File file = new File(targetDir, filename);
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    fos.write(data.getBytes("UTF-8"));
                    fos.flush();
                }

                JSObject result = new JSObject();
                result.put("uri", file.toURI().toString());
                result.put("path", file.getAbsolutePath());
                call.resolve(result);
            }

        } catch (Exception e) {
            call.reject("Error writing to Downloads: " + e.getMessage(), e);
        }
    }
}

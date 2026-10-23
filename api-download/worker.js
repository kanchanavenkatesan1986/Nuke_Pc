/**
 * Cloudflare Worker for R2 Movie/Media Streaming & High-Speed Downloads
 * Service Name: api-download
 * Bucket Binding: TVK_MOVIES -> tvk-movies
 *
 * Supports:
 * - Direct path access: /tamil/2026/jailer-2/Jailer_2_2026_HQ_PreDVD_1080p_HD.mp4
 * - Query param access: ?file=tamil/2026/jailer-2/Jailer_2_2026_HQ_PreDVD_1080p_HD.mp4
 * - HTTP Range requests (206 Partial Content) for video seeking/scrubbing
 * - Direct attachment download vs inline streaming
 * - Force download (?download=1 or ?dl=1) and Force stream (?stream=1 or ?play=1)
 * - Auto-detected MIME types and safe Content-Disposition headers
 * - Full CORS and security headers
 * - Class B Operation Reductions:
 *   * In-memory LRU metadata cache (avoids repeated HeadObject calls)
 *   * HTTP 304 Not Modified validation (If-None-Match & If-Modified-Since)
 *   * Bounded streaming chunks for open-ended range requests (avoids multi-GB stream churn)
 *   * Accurate Content-Type, Vary: Range, and browser-cacheable Cache-Control headers
 */

// Standard CORS response headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, ETag, Last-Modified, Cache-Control",
  "Access-Control-Max-Age": "86400"
};

// Comprehensive MIME type mapping for movie formats & assets
const mimeTypes = {
  // Video formats
  mp4: "video/mp4",
  mkv: "video/x-matroska",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  avi: "video/x-msvideo",
  ts: "video/mp2t",
  flv: "video/x-flv",
  wmv: "video/x-ms-wmv",
  "3gp": "video/3gpp",
  m2ts: "video/mp2t",
  vob: "video/x-ms-vob",
  ogv: "video/ogg",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",

  // Audio formats
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
  opus: "audio/opus",
  wma: "audio/x-ms-wma",

  // Subtitles
  srt: "text/plain",
  vtt: "text/vtt",
  sub: "text/plain",
  ass: "text/plain",
  ssa: "text/plain",

  // Images
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",

  // Archives & Documents
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",
  pdf: "application/pdf",
  txt: "text/plain",
  json: "application/json",
  nfo: "text/plain"
};

// Streamable media extensions that should default to inline streaming
const streamableExtensions = new Set([
  "mp4", "mkv", "webm", "mov", "m4v", "avi", "ts", "flv", "wmv", "3gp", "m2ts", "vob", "ogv", "mpg", "mpeg",
  "mp3", "m4a", "aac", "wav", "flac", "ogg", "opus", "wma",
  "srt", "vtt", "sub", "ass", "ssa",
  "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "avif"
]);

/**
 * Resolve MIME type by file extension
 */
function getMimeType(filename) {
  if (!filename) return "application/octet-stream";
  const ext = filename.split(".").pop().toLowerCase();
  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Check if a file should default to inline media streaming
 */
function isStreamableMedia(filename) {
  if (!filename) return false;
  const ext = filename.split(".").pop().toLowerCase();
  return streamableExtensions.has(ext);
}

/**
 * Standardized JSON error response
 */
function errorResponse(message, status, extraHeaders = {}) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...extraHeaders
    }
  });
}

// ==========================================
// IN-MEMORY METADATA CACHE (Reduces HeadObject Class B calls)
// ==========================================
const METADATA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL
const MAX_METADATA_CACHE_SIZE = 500;
const metadataCache = new Map();

function getCachedMetadata(key) {
  const item = metadataCache.get(key);
  if (!item) return null;
  if (Date.now() - item.cachedAt > METADATA_CACHE_TTL_MS) {
    metadataCache.delete(key);
    return null;
  }
  return item;
}

function setCachedMetadata(key, meta) {
  if (metadataCache.size >= MAX_METADATA_CACHE_SIZE) {
    const oldestKey = metadataCache.keys().next().value;
    metadataCache.delete(oldestKey);
  }
  metadataCache.set(key, {
    ...meta,
    cachedAt: Date.now()
  });
}

/**
 * Parse HTTP Range request header
 */
function parseRangeHeader(rangeHeader) {
  if (!rangeHeader) return null;
  const parts = rangeHeader.trim().split("=");
  if (parts.length !== 2 || parts[0] !== "bytes") return null;

  const rangeSpec = parts[1].trim();
  if (rangeSpec.includes(",")) return null; // Single range only

  const rangeMatch = rangeSpec.match(/^(\d*)-(\d*)$/);
  if (!rangeMatch) return null;

  const startStr = rangeMatch[1];
  const endStr = rangeMatch[2];

  if (!startStr && !endStr) return null;

  if (!startStr) {
    return {
      start: null,
      end: parseInt(endStr, 10),
      isSuffix: true
    };
  }

  return {
    start: parseInt(startStr, 10),
    end: endStr ? parseInt(endStr, 10) : null,
    isSuffix: false
  };
}

/**
 * Resolve range constraints against actual file size
 */
function resolveRange(parsedRange, size) {
  if (parsedRange.isSuffix) {
    let start = size - parsedRange.end;
    if (start < 0) start = 0;
    const end = size - 1;
    return {
      start,
      end,
      length: end - start + 1,
      unsatisfied: start >= size
    };
  }

  const start = parsedRange.start;
  let end = parsedRange.end;

  if (end === null || end >= size) {
    end = size - 1;
  }

  return {
    start,
    end,
    length: end - start + 1,
    unsatisfied: start >= size || start > end
  };
}

/**
 * Check if client ETag matches server ETag
 */
function etagsMatch(clientHeader, serverEtag) {
  if (!clientHeader || !serverEtag) return false;
  const cleanServer = serverEtag.replace(/^W\//, "").replace(/"/g, "").trim();
  const tokens = clientHeader.split(",").map(t => t.trim().replace(/^W\//, "").replace(/"/g, ""));
  return tokens.includes("*") || tokens.includes(cleanServer);
}

/**
 * Check if client date is after or equal to server upload date
 */
function ifModifiedSinceMatches(clientDateStr, serverUploaded) {
  if (!clientDateStr || !serverUploaded) return false;
  try {
    const clientDate = new Date(clientDateStr);
    const serverDate = new Date(serverUploaded);
    return !isNaN(clientDate.getTime()) && clientDate >= serverDate;
  } catch {
    return false;
  }
}

// Bounded streaming chunk size for open-ended Range: bytes=start- requests (20 MB)
// Prevents downloading multi-GB files on simple metadata probes or short view sessions
const DEFAULT_STREAM_CHUNK_BYTES = 20 * 1024 * 1024;

export default {
  async fetch(request, env) {
    // 1. Verify HTTP method
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS") {
      return errorResponse("Method not allowed", 405);
    }

    // 2. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // 3. Verify R2 Bucket binding
    const bucket = env.TVK_MOVIES || env.MY_BUCKET;
    if (!bucket) {
      return errorResponse("R2 Bucket binding 'TVK_MOVIES' is not configured", 500);
    }

    try {
      const url = new URL(request.url);

      // Extract file path from either:
      // A) Query parameter (?file=... or ?key=...)
      // B) Direct URL pathname (/tamil/2026/jailer-2/Jailer_2_2026_HQ_PreDVD_1080p_HD.mp4)
      let fileParam = url.searchParams.get("file") || url.searchParams.get("key");

      if (!fileParam) {
        const rawPath = url.pathname.replace(/^\/+/, "");
        if (rawPath && rawPath !== "favicon.ico" && rawPath !== "robots.txt") {
          try {
            fileParam = decodeURIComponent(rawPath);
          } catch {
            fileParam = rawPath;
          }
        }
      }

      // Root path health & usage check
      if (!fileParam || fileParam.trim() === "") {
        return new Response(JSON.stringify({
          status: "active",
          service: "VIP Movies R2 Direct Stream & Download API",
          usage: "https://api-download.akatsuki-pvt-ltd.workers.dev/:category/:year/:movie/:filename.mp4",
          example: "https://api-download.akatsuki-pvt-ltd.workers.dev/tamil/2026/jailer-2/Jailer_2_2026_HQ_PreDVD_1080p_HD.mp4"
        }, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...corsHeaders
          }
        });
      }

      // Normalize key (strip leading slashes, trim)
      const key = fileParam.trim().replace(/^\/+/, "");

      // Determine display filename
      const nameParam = url.searchParams.get("name");
      let filename = nameParam ? nameParam.trim() : (key.split("/").pop() || key);
      if (!filename) filename = "video.mp4";

      // Determine download vs inline streaming
      const downloadParam = url.searchParams.get("download") || url.searchParams.get("dl");
      const streamParam = url.searchParams.get("stream") || url.searchParams.get("play");

      let isDownload = false;
      if (downloadParam === "1" || downloadParam === "true") {
        isDownload = true;
      } else if (downloadParam === "0" || streamParam === "1" || streamParam === "true") {
        isDownload = false;
      } else {
        // Streamable media files default to inline playback; others default to download
        isDownload = !isStreamableMedia(filename);
      }

      // 4. Parse Range Request Header
      const rangeHeader = request.headers.get("Range");
      const parsedRange = parseRangeHeader(rangeHeader);

      // 5. Check in-memory metadata cache for fast HEAD & 304 responses
      let cachedMeta = getCachedMetadata(key);

      const ifNoneMatch = request.headers.get("If-None-Match");
      const ifModifiedSince = request.headers.get("If-Modified-Since");

      // Check for 304 Not Modified if we have cached metadata
      if (cachedMeta) {
        const matchesEtag = ifNoneMatch && etagsMatch(ifNoneMatch, cachedMeta.etag);
        const matchesDate = ifModifiedSince && ifModifiedSinceMatches(ifModifiedSince, cachedMeta.uploaded);

        if ((matchesEtag || matchesDate) && !rangeHeader) {
          const notModifiedHeaders = new Headers(corsHeaders);
          notModifiedHeaders.set("ETag", cachedMeta.etag);
          notModifiedHeaders.set("Accept-Ranges", "bytes");
          notModifiedHeaders.set("Vary", "Range");
          notModifiedHeaders.set("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
          if (cachedMeta.uploaded) {
            notModifiedHeaders.set("Last-Modified", new Date(cachedMeta.uploaded).toUTCString());
          }
          return new Response(null, { status: 304, headers: notModifiedHeaders });
        }
      }

      // 6. Handle HEAD Request
      if (request.method === "HEAD") {
        let headObj = cachedMeta;
        if (!headObj) {
          headObj = await bucket.head(key);
          if (!headObj) {
            return errorResponse("File not found", 404);
          }
          const serverEtag = headObj.httpEtag || (headObj.etag ? `"${headObj.etag}"` : null);
          const metaToCache = {
            size: headObj.size,
            etag: serverEtag,
            uploaded: headObj.uploaded,
            httpMetadata: headObj.httpMetadata || {},
            contentType: headObj.httpMetadata?.contentType || getMimeType(filename)
          };
          setCachedMetadata(key, metaToCache);
          headObj = metaToCache;
        }

        // Check conditional 304 for HEAD
        if ((ifNoneMatch && etagsMatch(ifNoneMatch, headObj.etag)) ||
            (ifModifiedSince && ifModifiedSinceMatches(ifModifiedSince, headObj.uploaded))) {
          const h304 = new Headers(corsHeaders);
          h304.set("ETag", headObj.etag);
          h304.set("Accept-Ranges", "bytes");
          h304.set("Vary", "Range");
          h304.set("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
          if (headObj.uploaded) h304.set("Last-Modified", new Date(headObj.uploaded).toUTCString());
          return new Response(null, { status: 304, headers: h304 });
        }

        const headHeaders = new Headers(corsHeaders);
        headHeaders.set("Accept-Ranges", "bytes");
        headHeaders.set("Vary", "Range");
        headHeaders.set("X-Content-Type-Options", "nosniff");
        headHeaders.set("Referrer-Policy", "no-referrer");
        headHeaders.set("X-Frame-Options", "DENY");

        let contentType = isDownload ? "application/octet-stream" : (headObj.contentType || getMimeType(filename));
        headHeaders.set("Content-Type", contentType);

        headHeaders.set("Cache-Control", isDownload 
          ? "public, max-age=86400" 
          : "public, max-age=604800, stale-while-revalidate=86400"
        );

        if (headObj.etag) headHeaders.set("ETag", headObj.etag);
        if (headObj.uploaded) headHeaders.set("Last-Modified", new Date(headObj.uploaded).toUTCString());

        const dispositionType = isDownload ? "attachment" : "inline";
        const safeFilename = encodeURIComponent(filename)
          .replace(/['()]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase())
          .replace(/\*/g, "%2A");
        headHeaders.set("Content-Disposition", `${dispositionType}; filename="${filename.replace(/"/g, '\\"')}"; filename*=UTF-8''${safeFilename}`);

        if (parsedRange) {
          const resolved = resolveRange(parsedRange, headObj.size);
          if (resolved.unsatisfied) {
            return errorResponse("Requested range not satisfiable", 416, {
              "Content-Range": `bytes */${headObj.size}`
            });
          }
          headHeaders.set("Content-Range", `bytes ${resolved.start}-${resolved.end}/${headObj.size}`);
          headHeaders.set("Content-Length", resolved.length.toString());
          return new Response(null, { status: 206, headers: headHeaders });
        }

        headHeaders.set("Content-Length", headObj.size.toString());
        return new Response(null, { status: 200, headers: headHeaders });
      }

      // 7. GET Request: prepare range parameters
      let r2Range = undefined;

      if (parsedRange) {
        if (parsedRange.isSuffix) {
          r2Range = { suffix: parsedRange.end };
        } else if (parsedRange.end !== null) {
          // Explicit range with both start and end specified
          r2Range = {
            offset: parsedRange.start,
            length: parsedRange.end - parsedRange.start + 1
          };
        } else {
          // Open-ended range: Range: bytes=start-
          // For streaming playback, bound the chunk to DEFAULT_STREAM_CHUNK_BYTES (20MB)
          // to prevent R2 from streaming the entire multi-GB file on initial probes or short seeks.
          // For downloads, stream full remaining bytes.
          if (!isDownload) {
            r2Range = {
              offset: parsedRange.start,
              length: DEFAULT_STREAM_CHUNK_BYTES
            };
          } else {
            r2Range = { offset: parsedRange.start };
          }
        }
      }

      // 8. Fetch object from Cloudflare R2
      let object = null;
      try {
        object = await bucket.get(key, { range: r2Range });
      } catch (err) {
        // If range was unsatisfiable or threw an R2 range error, return 416 safely
        if (cachedMeta) {
          return errorResponse("Requested range not satisfiable", 416, {
            "Content-Range": `bytes */${cachedMeta.size}`
          });
        }
        throw err;
      }

      if (!object) {
        return errorResponse("File not found", 404);
      }

      // Update in-memory metadata cache from the retrieved R2 object
      const serverEtag = object.httpEtag || (object.etag ? `"${object.etag}"` : null);
      let detectedContentType = object.httpMetadata?.contentType;
      if (!detectedContentType || detectedContentType === "application/octet-stream") {
        detectedContentType = getMimeType(filename);
      }

      setCachedMetadata(key, {
        size: object.size,
        etag: serverEtag,
        uploaded: object.uploaded,
        httpMetadata: object.httpMetadata || {},
        contentType: detectedContentType
      });

      // Check conditional request (If-None-Match) after getting object
      if ((ifNoneMatch && etagsMatch(ifNoneMatch, serverEtag)) ||
          (ifModifiedSince && ifModifiedSinceMatches(ifModifiedSince, object.uploaded))) {
        if (!rangeHeader) {
          if (object.body) await object.body.cancel();
          const h304 = new Headers(corsHeaders);
          if (serverEtag) h304.set("ETag", serverEtag);
          h304.set("Accept-Ranges", "bytes");
          h304.set("Vary", "Range");
          h304.set("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
          if (object.uploaded) h304.set("Last-Modified", object.uploaded.toUTCString());
          return new Response(null, { status: 304, headers: h304 });
        }
      }

      // Range resolution & validation
      let resolvedRange = null;
      if (object.range) {
        // R2 natively sliced the range
        resolvedRange = {
          start: object.range.offset,
          end: object.range.offset + object.range.length - 1,
          length: object.range.length
        };
      } else if (parsedRange) {
        resolvedRange = resolveRange(parsedRange, object.size);
        if (resolvedRange.unsatisfied) {
          if (object.body) await object.body.cancel();
          return errorResponse("Requested range not satisfiable", 416, {
            "Content-Range": `bytes */${object.size}`
          });
        }
      }

      // 9. Build Response Headers
      const headers = new Headers();
      for (const [k, v] of Object.entries(corsHeaders)) {
        headers.set(k, v);
      }

      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Referrer-Policy", "no-referrer");
      headers.set("X-Frame-Options", "DENY");
      headers.set("Accept-Ranges", "bytes");
      headers.set("Vary", "Range");

      // Content-Type
      let contentType = isDownload ? "application/octet-stream" : detectedContentType;
      headers.set("Content-Type", contentType);

      // Cache-Control
      let cacheControl = isDownload 
        ? "public, max-age=86400" 
        : "public, max-age=604800, stale-while-revalidate=86400";
      headers.set("Cache-Control", cacheControl);

      // ETag & Last-Modified
      if (serverEtag) headers.set("ETag", serverEtag);
      if (object.uploaded) headers.set("Last-Modified", object.uploaded.toUTCString());

      if (object.httpMetadata?.contentEncoding) {
        headers.set("Content-Encoding", object.httpMetadata.contentEncoding);
      }
      if (object.httpMetadata?.contentLanguage) {
        headers.set("Content-Language", object.httpMetadata.contentLanguage);
      }

      // Content-Disposition
      const dispositionType = isDownload ? "attachment" : "inline";
      const safeFilename = encodeURIComponent(filename)
        .replace(/['()]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase())
        .replace(/\*/g, "%2A");
      headers.set(
        "Content-Disposition",
        `${dispositionType}; filename="${filename.replace(/"/g, '\\"')}"; filename*=UTF-8''${safeFilename}`
      );

      // Range status & content headers
      let status = 200;
      if (resolvedRange) {
        status = 206;
        headers.set("Content-Range", `bytes ${resolvedRange.start}-${resolvedRange.end}/${object.size}`);
        headers.set("Content-Length", resolvedRange.length.toString());
      } else {
        headers.set("Content-Length", object.size.toString());
      }

      return new Response(object.body || null, { status, headers });

    } catch (error) {
      console.error("[API_DOWNLOAD_ERROR]", error);
      return errorResponse(`Internal Server Error: ${error.message}`, 500);
    }
  }
};

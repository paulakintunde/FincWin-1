'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');

var PORT = 4141;
var ROOT = __dirname;

var MIME = {
  '.html': 'text/html',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt':  'text/plain'
};

// WARNING: development-only server — do not deploy to production.
http.createServer(function(req, res) {
  var urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  // Guard against path traversal (audit C-02): resolve the canonical path and
  // reject anything that escapes the project root.
  var filePath = path.resolve(ROOT, '.' + urlPath);
  var rootResolved = path.resolve(ROOT);
  if (filePath !== rootResolved && !filePath.startsWith(rootResolved + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, function(err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + urlPath);
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    var contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      // Restrict resource origins to mitigate XSS and data exfiltration.
      // Firebase SDK is now vendored locally — gstatic.com removed from script-src.
      // accounts.google.com: Google Identity Services for Drive OAuth.
      'Content-Security-Policy': [
        "default-src 'self' blob:",
        "script-src 'self' https://accounts.google.com",
        "script-src-elem 'self' https://accounts.google.com",
        "script-src-attr 'none'",
        "connect-src 'self' https://api.anthropic.com https://api.openai.com https://open.er-api.com https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://accounts.google.com",
        "img-src 'self' data: blob:",
        "font-src 'self' https://fonts.gstatic.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ].join('; '),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
    });
    res.end(data);
  });
}).listen(PORT, function() {
  console.log('FincWin dev server running at http://localhost:' + PORT);
});

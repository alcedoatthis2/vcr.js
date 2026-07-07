import * as https from 'https';
import * as url from 'url';
import { Request } from 'express';

const allowedEncodings = ['deflate', 'gzip'];

export default function createProxyRequestOptions(req: Request, realApiBaseUrl: string): https.RequestOptions {
  // create options for request to real API; copy headers so req.headers stays untouched
  const uri = url.parse(realApiBaseUrl, true);
  const headers = { ...req.headers };
  delete headers['host']; // tslint:disable-line:no-string-literal
  delete headers['if-modified-since']; // tslint:disable-line:no-string-literal
  delete headers['if-none-match']; // tslint:disable-line:no-string-literal

  const givenEncodings = `${headers['accept-encoding']}`.split(',').map(x => x.trim()); // tslint:disable-line:no-string-literal
  const acceptedEncoding = allowedEncodings.filter(e => givenEncodings.indexOf(e) !== -1)[0];
  // unlike `request`, native http.request throws on undefined header values
  if (acceptedEncoding) {
    headers['accept-encoding'] = acceptedEncoding; // tslint:disable-line:no-string-literal
  } else {
    delete headers['accept-encoding']; // tslint:disable-line:no-string-literal
  }

  return {
    protocol: uri.protocol,
    hostname: uri.hostname,
    port: parseInt(uri.port || '', 10) || undefined,
    method: req.method,
    // plain concat — path.join would normalize `..` and `//` inside the query string
    path: (uri.pathname === '/' ? '' : uri.pathname || '') + req.url,
    headers,
    rejectUnauthorized: false,
  };
}

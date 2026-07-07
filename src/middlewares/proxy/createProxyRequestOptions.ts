import * as http from 'http';
import * as url from 'url';
import * as path from 'path';
import { Request } from 'express';

const allowedEncodings = ['deflate', 'gzip'];

// http.RequestOptions plus the https-only TLS flag we need for self-signed QA certs
export interface ProxyRequestOptions extends http.RequestOptions {
  rejectUnauthorized?: boolean;
}

export default function createProxyRequestOptions(req: Request, realApiBaseUrl: string): ProxyRequestOptions {
  // create options for request to real API; copy headers so req.headers stays untouched
  const uri = url.parse(realApiBaseUrl, true);
  const headers = { ...req.headers };
  delete headers['host']; // tslint:disable-line:no-string-literal
  delete headers['if-modified-since']; // tslint:disable-line:no-string-literal
  delete headers['if-none-match']; // tslint:disable-line:no-string-literal

  const givenEncodings = `${headers['accept-encoding']}`.split(',').map(x => x.trim()); // tslint:disable-line:no-string-literal
  headers['accept-encoding'] = allowedEncodings.filter(e => givenEncodings.indexOf(e) !== -1)[0];

  return {
    protocol: uri.protocol,
    hostname: uri.hostname,
    port: parseInt(uri.port || '', 10) || undefined,
    method: req.method,
    path: path.join(uri.path as string, req.url),
    headers,
    rejectUnauthorized: false,
  };
}

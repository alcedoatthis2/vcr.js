import * as chalk from "chalk";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { IncomingMessage } from "http";
import * as request from "request";
import { PassThrough } from "stream";
import getFixturesDirs from "../../getFixturesDirs";
import createProxyRequestOptions from "./createProxyRequestOptions";
import getFixturePath from "./getFixturePath";
import getProxyResponseHeaders from "./getProxyResponseHeaders";
import writeFixture from "./writeFixture";

export default (realApiBaseUrl: string, outputDir?: string): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === "/") return next();

    const apiReqURL = `${realApiBaseUrl}${req.originalUrl}`;
    const outputCassette = getFixturesDirs(
      req,
      outputDir ? [outputDir] : [],
    )[0];

    // pipe request from stub server to real API
    req
      .pipe(request(apiReqURL, createProxyRequestOptions(req, realApiBaseUrl)))
      .on("error", (e: Error) => next(e))
      .on("response", (proxyRes: IncomingMessage) => {
        // response from real API, if not OK, pass control to next
        if (
          !proxyRes.statusCode ||
          proxyRes.statusCode < 200 ||
          proxyRes.statusCode >= 300
        ) {
          console.log(
            `${chalk.magenta("[Stub server]")} proxy request to ${chalk.yellow(realApiBaseUrl + req.originalUrl)} ended up with ${chalk.red(`${proxyRes.statusCode}`)}`,
          );
          // console.log(`${chalk.magenta('[Stub server]')} request headers: ${JSON.stringify(req.headers, null, 2)}`);
          // console.log(`${chalk.magenta('[Stub server]')} response headers: ${JSON.stringify(proxyRes.headers, null, 2)}`);
          return next();
        }
        // console.log(`${chalk.blue('[Stub server]')} request headers: ${JSON.stringify(req.headers, null, 2)}`);
        // console.log(`${chalk.blue('[Stub server]')} response status: ${proxyRes.statusCode} headers: ${JSON.stringify(proxyRes.headers, null, 2)}`);

        // response from API is OK
        console.log(
          `${chalk.magenta("[Stub server]")} proxy request to ${chalk.yellow(realApiBaseUrl + req.originalUrl)} ended up with ${chalk.green(`${proxyRes.statusCode}`)} returning its response`,
        );
        const headers = {
          ...proxyRes.headers,
          ...getProxyResponseHeaders(req, apiReqURL, outputCassette),
        };
        res.writeHead(proxyRes.statusCode || 500, headers);

        // Create PassThrough streams to allow piping to multiple destinations
        const responseStream = new PassThrough();
        const fixtureStream = new PassThrough();

        proxyRes.on("data", (chunk: Buffer) => {
          responseStream.write(chunk);
          fixtureStream.write(chunk);
        });
        proxyRes.on("end", () => {
          responseStream.end();
          fixtureStream.end();
        });
        proxyRes.on("error", (e: Error) => {
          responseStream.emit("error", e);
          fixtureStream.emit("error", e);
          next(e);
        });

        // pipe API response to client till the 'end'
        responseStream.pipe(res);
        responseStream.on("end", () => {
          res.end();
        });

        // write response as fixture on the disc
        if (outputCassette) {
          const fullPath = getFixturePath(req, outputCassette, proxyRes);
          writeFixture(
            fullPath,
            fixtureStream,
            proxyRes.headers["content-encoding"],
            next,
          );
        }
      });
  };

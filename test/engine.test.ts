import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import { httpConnector } from "@/lib/connectors/engine/http";
import type { HttpSpec } from "@/lib/connectors/engine/types";

interface Mock {
  url: string;
  close: () => Promise<void>;
  deleted: string[];
  lastAuth: string | undefined;
  lastPaths: string[];
}

/** Spin up an ephemeral HTTP server driven by `handler`. */
function startServer(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void): Promise<Mock> {
  const mock: Mock = { url: "", close: async () => {}, deleted: [], lastAuth: undefined, lastPaths: [] };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      mock.lastAuth = req.headers["authorization"];
      mock.lastPaths.push(`${req.method} ${req.url}`);
      handler(req, res);
    });
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      mock.url = `http://127.0.0.1:${port}`;
      mock.close = () =>
        new Promise<void>((r) => {
          // fetch keeps idle keep-alive sockets open, which would otherwise
          // block server.close() forever — force them closed first.
          (server as any).closeAllConnections?.();
          server.close(() => r());
        });
      resolve(mock);
    });
  });
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

test("engine: cursor (fullPage) pagination finds + deletes every match", async () => {
  const customers = ["c1", "c2", "c3", "c4", "c5"];
  const mock = await startServer((req, res) => {
    const url = new URL(req.url ?? "", mock.url);
    if (req.method === "GET" && url.pathname === "/v1/customers") {
      const after = url.searchParams.get("starting_after");
      const idx = after ? customers.indexOf(after) + 1 : 0;
      const slice = customers.slice(idx, idx + 2);
      return send(res, 200, { data: slice.map((id) => ({ id })) });
    }
    if (req.method === "DELETE" && url.pathname.startsWith("/v1/customers/")) {
      mock.deleted.push(url.pathname.split("/").pop()!);
      return send(res, 200, { id: url.pathname.split("/").pop() });
    }
    send(res, 404, {});
  });

  const spec: HttpSpec = {
    key: "stripe",
    transport: "http",
    label: "Stripe",
    baseUrl: mock.url,
    auth: { type: "basic", user: "{cred.secret_key}", pass: "" },
    find: {
      method: "GET",
      path: "/v1/customers",
      query: { email: "{email}", limit: "100" },
      paginate: { type: "fullPage", pageSize: 2, nextParam: "starting_after", nextPath: "id" },
      resultsPath: "data",
      idPath: "id",
    },
    delete: { method: "DELETE", path: "/v1/customers/{res.id}", itemNoun: "customer" },
  };

  const result = await httpConnector(spec)("user@example.com", { secret_key: "sk_test_123" });
  assert.equal(result.status, "success");
  assert.equal(result.message, "Deleted 5 customers");
  assert.deepEqual(mock.deleted.sort(), ["c1", "c2", "c3", "c4", "c5"]);
  await mock.close();
});

test("engine: offset pagination stops at total", async () => {
  const items = ["i1", "i2", "i3"];
  const mock = await startServer((req, res) => {
    const url = new URL(req.url ?? "", mock.url);
    if (req.method === "GET" && url.pathname === "/items") {
      const offset = Number(url.searchParams.get("offset") ?? "0");
      const slice = items.slice(offset, offset + 2);
      return send(res, 200, { data: slice.map((id) => ({ id })), total: items.length });
    }
    if (req.method === "DELETE") {
      mock.deleted.push(url.pathname.split("/").pop()!);
      return send(res, 200, {});
    }
    send(res, 404, {});
  });

  const spec = {
    key: "stripe",
    transport: "http",
    label: "Listable",
    baseUrl: mock.url,
    auth: { type: "none" },
    find: {
      method: "GET",
      path: "/items",
      query: { count: "2", offset: "0" },
      paginate: { type: "offset", pageSize: 2, offsetParam: "offset", totalPath: "total" },
      resultsPath: "data",
      idPath: "id",
    },
    delete: { method: "DELETE", path: "/items/{res.id}", itemNoun: "item" },
  } as const;

  const result = await httpConnector(spec)("user@example.com", {});
  assert.equal(result.status, "success");
  assert.equal(result.message, "Deleted 3 items");
  assert.deepEqual(mock.deleted.sort(), ["i1", "i2", "i3"]);
  await mock.close();
});

test("engine: {emailMd5} transform resolves Mailchimp-style member path", async () => {
  const expectedMd5 = crypto.createHash("md5").update("user@example.com").digest("hex");
  let sawMd5Path = false;
  const mock = await startServer((req, res) => {
    const url = new URL(req.url ?? "", mock.url);
    if (req.method === "GET" && url.pathname === "/lists") {
      return send(res, 200, { lists: [{ id: "l1" }], total: 1 });
    }
    if (req.method === "POST" && url.pathname.includes(`/lists/l1/members/${expectedMd5}/actions/delete-permanent`)) {
      sawMd5Path = true;
      return send(res, 204, {});
    }
    send(res, 404, {});
  });

  const spec: HttpSpec = {
    key: "mailchimp",
    transport: "http",
    label: "Mailchimp",
    baseUrl: mock.url,
    auth: { type: "basic", user: "anystring", pass: "{cred.api_key}" },
    find: {
      method: "GET",
      path: "/lists",
      query: { count: "100", offset: "0" },
      paginate: { type: "offset", pageSize: 100, offsetParam: "offset", totalPath: "total" },
      resultsPath: "lists",
      idPath: "id",
    },
    delete: {
      method: "POST",
      path: "/lists/{res.id}/members/{emailMd5}/actions/delete-permanent",
      successStatuses: [204],
      ignoreStatuses: [404],
      failStatuses: [401, 403],
      continueOnOther: true,
      itemNoun: "subscriber",
    },
  };

  const result = await httpConnector(spec)("user@example.com", { api_key: "abc-us1" });
  assert.equal(result.status, "success");
  assert.equal(sawMd5Path, true);
  await mock.close();
});

test("engine: Basic auth header + status semantics (success / ignore / fail)", async () => {
  const mock = await startServer((req, res) => {
    const url = new URL(req.url ?? "", mock.url);
    if (req.method === "GET" && url.pathname === "/users") {
      return send(res, 200, { data: [{ id: "u1" }] });
    }
    if (req.method === "DELETE" && url.pathname === "/users/u1") {
      // status controlled via ?st= query for the test
      const st = Number(url.searchParams.get("st") ?? "200");
      return send(res, st, {});
    }
    send(res, 404, {});
  });

  const baseSpec = (st: number) => ({
    key: "salesforce",
    transport: "http",
    label: "Acme",
    baseUrl: mock.url,
    auth: { type: "basic", user: "{cred.secret_key}", pass: "" },
    find: { method: "GET", path: "/users", query: { st: String(st) }, resultsPath: "data", idPath: "id" },
    delete: { method: "DELETE", path: "/users/{res.id}", query: { st: String(st) }, itemNoun: "user" },
  } as const);

  // success (200)
  let r = await httpConnector(baseSpec(200))("user@example.com", { secret_key: "sk" });
  assert.equal(r.status, "success");
  // ignore (404) -> nothing deleted -> skipped
  r = await httpConnector(baseSpec(404))("user@example.com", { secret_key: "sk" });
  assert.equal(r.status, "skipped");
  // hard fail (401)
  r = await httpConnector(baseSpec(401))("user@example.com", { secret_key: "sk" });
  assert.equal(r.status, "failed");
  assert.match(r.message, /authentication failed/);

  // Basic auth header must be base64("sk:")
  assert.equal(mock.lastAuth, `Basic ${Buffer.from("sk:").toString("base64")}`);
  await mock.close();
});

test("engine: missing match returns skipped, not failed", async () => {
  const mock = await startServer((_req, res) => send(res, 200, { data: [] }));
  const spec = {
    key: "activecampaign",
    transport: "http",
    label: "Empty",
    baseUrl: mock.url,
    auth: { type: "none" },
    find: { method: "GET", path: "/x", resultsPath: "data", idPath: "id" },
    delete: { method: "DELETE", path: "/x/{res.id}" },
  } as const;
  const r = await httpConnector(spec)("nobody@example.com", {});
  assert.equal(r.status, "skipped");
  await mock.close();
});

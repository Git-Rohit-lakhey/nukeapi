import type { ConnectorResult, VercelBlobCredentials } from "@/types/connector";

export async function deleteVercelBlob(
  _email: string,
  creds: VercelBlobCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();

  try {
    const { list, del } = await import("@vercel/blob");

    const urls: string[] = [];
    let cursor: string | undefined;
    do {
      const res = await list({
        token: creds.api_token,
        prefix: creds.prefix_pattern,
        cursor,
      });
      for (const b of res.blobs) {
        if (b.url) urls.push(b.url);
      }
      cursor = res.hasMore ? res.cursor : undefined;
    } while (cursor);

    if (urls.length === 0) {
      return {
        integration: "vercelblob",
        status: "skipped",
        message: `No blobs matched ${creds.prefix_pattern}`,
        durationMs: Date.now() - start,
      };
    }

    for (const url of urls) {
      await del(url, { token: creds.api_token });
    }

    return {
      integration: "vercelblob",
      status: "success",
      message: `Deleted ${urls.length} blob(s) under ${creds.prefix_pattern}`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "vercelblob",
      status: "failed",
      message: "Vercel Blob deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

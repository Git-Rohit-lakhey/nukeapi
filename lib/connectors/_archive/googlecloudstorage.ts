import type {
  ConnectorResult,
  GoogleCloudStorageCredentials,
} from "@/types/connector";

export async function deleteGoogleCloudStorage(
  _email: string,
  creds: GoogleCloudStorageCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();
  let storage: import("@google-cloud/storage").Storage | undefined;

  try {
    const { Storage } = await import("@google-cloud/storage");
    storage = new Storage({ credentials: JSON.parse(creds.service_account_json) });
    const bucket = storage.bucket(creds.bucket);

    const [files] = await bucket.getFiles({ prefix: creds.prefix_pattern });

    if (files.length === 0) {
      return {
        integration: "googlecloudstorage",
        status: "skipped",
        message: `No objects matched ${creds.prefix_pattern} in ${creds.bucket}`,
        durationMs: Date.now() - start,
      };
    }

    // deleteFiles honors the same prefix and paginates internally.
    await bucket.deleteFiles({ prefix: creds.prefix_pattern });

    return {
      integration: "googlecloudstorage",
      status: "success",
      message: `Deleted ${files.length} object(s) under ${creds.prefix_pattern}`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "googlecloudstorage",
      status: "failed",
      message: "Google Cloud Storage deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  } finally {
    // @google-cloud/storage manages its own client lifecycle; no explicit
    // close() is exposed on the Storage type, so nothing to tear down.
  }
}

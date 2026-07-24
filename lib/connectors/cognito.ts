import type { ConnectorResult, CognitoCredentials } from "@/types/connector";

export async function deleteCognito(
  email: string,
  creds: CognitoCredentials,
): Promise<ConnectorResult> {
  const start = Date.now();

  try {
    // AWS SDK is dynamically imported so it never ends up in a client bundle
    // and only loads when this connector actually runs.
    const {
      CognitoIdentityProviderClient,
      AdminGetUserCommand,
      AdminDeleteUserCommand,
    } = await import("@aws-sdk/client-cognito-identity-provider");

    const client = new CognitoIdentityProviderClient({
      region: creds.region,
      credentials: {
        accessKeyId: creds.access_key,
        secretAccessKey: creds.secret_key,
      },
    });

    // Look the user up first so we can distinguish "not found" (skipped)
    // from a genuine failure (failed). Cognito uses the email as Username.
    try {
      await client.send(
        new AdminGetUserCommand({
          UserPoolId: creds.user_pool_id,
          Username: email,
        }),
      );
    } catch (getErr) {
      const name = (getErr as { name?: string })?.name;
      if (name === "UserNotFoundException") {
        return {
          integration: "cognito",
          status: "skipped",
          message: "No Cognito user matched that email",
          durationMs: Date.now() - start,
        };
      }
      // Any other lookup error (auth, permissions, network) is a real failure.
      throw getErr;
    }

    await client.send(
      new AdminDeleteUserCommand({
        UserPoolId: creds.user_pool_id,
        Username: email,
      }),
    );

    return {
      integration: "cognito",
      status: "success",
      message: `Deleted user ${email} from Cognito user pool`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      integration: "cognito",
      status: "failed",
      message: "Cognito deletion failed",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

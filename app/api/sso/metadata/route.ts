import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/db/supabase";
import { errorResponse, withErrorHandler, ApiError } from "@/lib/engine/errors";
import { getPlanForUser } from "@/lib/engine/metering";
import { isEnterprise } from "@/lib/constants/compliance";
import { getSpMetadata, SP_ENTITY_ID } from "@/lib/sso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Enterprise SAML SP metadata. The entityID / ACS URL are derived from
 * NEXT_PUBLIC_APP_URL. Gated to Enterprise so non-Enterprise accounts don't
 * advertise an SSO endpoint they can't configure.
 */
export const GET = withErrorHandler(async (_req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return errorResponse("UNAUTHORIZED", "Sign in required", 401);
  const plan = await getPlanForUser(user.id);
  if (!isEnterprise(plan)) {
    throw new ApiError("PLAN_REQUIRED", "SSO / SAML requires an Enterprise plan", 403);
  }
  const xml = getSpMetadata();
  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/samlmetadata+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="nukeapi-sp-metadata.xml"`,
      "X-SP-EntityID": SP_ENTITY_ID,
    },
  });
});

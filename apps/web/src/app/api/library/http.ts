import { z } from "zod";
import { createServerSupabase } from "@/server/db/client";
import type {
  ServiceContext,
  ServiceSupabaseClient,
} from "@/server/services/context";
import { ServiceError } from "@/server/services/errors";

export async function getRouteServiceContext(): Promise<ServiceContext | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    userId: user.id,
    supabase: supabase as unknown as ServiceSupabaseClient,
  };
}

export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}

export function serviceErrorResponse(error: unknown) {
  if (error instanceof ServiceError) {
    const statusByCode = {
      database: 500,
      not_found: 404,
      invalid_input: 400,
      conflict: 409,
    } satisfies Record<ServiceError["code"], number>;

    return Response.json(
      { error: error.message, code: error.code },
      { status: statusByCode[error.code] },
    );
  }

  console.error("Unexpected API error", error);
  return Response.json({ error: "Unexpected server error." }, { status: 500 });
}

export async function parseJsonBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<
  { ok: true; data: z.infer<Schema> } | { ok: false; response: Response }
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Invalid JSON body." }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "Invalid request body.",
          issues: z.treeifyError(parsed.error),
        },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

export const nullableUuidSchema = z.string().uuid().nullable();

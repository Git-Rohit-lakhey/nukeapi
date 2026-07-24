export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface ApiSuccessBody<T = unknown> {
  success: true;
  data: T;
}

export type ApiResponse<T = unknown> = ApiSuccessBody<T> | ApiErrorBody;

export interface SessionUser {
  id: string;
  email: string;
}

export interface AuthedApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  expires_at: string | null;
}

export interface ConnectorSaveBody {
  integration: string;
  credentials: Record<string, string>;
}

export interface CreateKeyBody {
  name: string;
  expires_at?: string | null;
}

export interface CreateKeyResponse {
  id: string;
  name: string;
  key: string; // raw key — returned exactly once
  prefix: string;
  key_lookup_hash: string;
  created_at: string;
}

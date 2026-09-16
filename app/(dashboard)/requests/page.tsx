"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/db/browser";

interface ReqRow {
  id: string;
  subject_email: string;
  status: string;
  created_at: string;
  integrations_requested: string[];
  integrations_completed: string[];
  integrations_failed: string[];
}
interface AuditRow {
  integration: string;
  status: string;
  message: string;
  error_detail: string | null;
  duration_ms: number | null;
}

export default function RequestsPage() {
  const [rows, setRows] = useState<ReqRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  async function load() {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase
      .from("deletion_requests")
      .select("id,subject_email,status,created_at,integrations_requested,integrations_completed,integrations_failed")
      .order("created_at", { ascending: false })
      .limit(50);
    setRows((data as ReqRow[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function openAudit(id: string) {
    setSelected(id);
    setLoadingAudit(true);
    const supabase = getSupabaseBrowser();
    const { data } = await supabase
      .from("audit_logs")
      .select("integration,status,message,error_detail,duration_ms")
      .eq("deletion_request_id", id)
      .order("created_at", { ascending: true });
    setAudit((data as AuditRow[]) ?? []);
    setLoadingAudit(false);
  }

  return (
    <div>
      <p className="eyebrow">requests</p>
      <h1 style={{ fontSize: 30 }}>Deletion requests</h1>

      <div className="grid grid-2" style={{ marginTop: 20, alignItems: "flex-start" }}>
        <div className="card">
          {rows.length === 0 ? (
            <p>No requests yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>When</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => openAudit(r.id)}>
                    <td>{r.subject_email}</td>
                    <td>
                      <span
                        className={`badge badge-${r.status === "failed" ? "failed" : r.status === "completed" ? "success" : "skipped"}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button className="btn btn-sm">Detail</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 16 }}>Audit detail</h3>
          {!selected && <p style={{ marginTop: 8 }}>Select a request to see per-integration results.</p>}
          {selected && loadingAudit && <p style={{ marginTop: 8 }}>Loading…</p>}
          {selected && !loadingAudit && (
            <div style={{ marginTop: 8 }}>
              {audit.map((a, i) => (
                <div
                  key={i}
                  style={{
                    borderLeft: `2px solid ${
                      a.status === "success" ? "var(--emerald)" : a.status === "failed" ? "var(--rose)" : "var(--amber)"
                    }`,
                    paddingLeft: 10,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{a.integration}</div>
                  <div className="dim" style={{ fontSize: 13 }}>{a.message}</div>
                  {a.error_detail && (
                    <div className="mono" style={{ fontSize: 11, color: "var(--rose)" }}>
                      {a.error_detail}
                    </div>
                  )}
                </div>
              ))}
              <a className="btn btn-sm btn-ghost" href={`/api/requests/${selected}/pdf`}>
                Download signed PDF
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

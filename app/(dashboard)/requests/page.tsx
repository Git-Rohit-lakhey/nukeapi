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

  function badgeClass(s: string) {
    if (s === "completed" || s === "success") return "badge-success";
    if (s === "failed") return "badge-failed";
    return "badge-skipped";
  }

  return (
    <div className="anim-fadeUp">
      <p className="eyebrow">requests</p>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 30, margin: 0 }}>Deletion requests</h1>
        <span className="dim" style={{ fontSize: 12.5 }}>{rows.length} in history · click a row for audit</span>
      </div>

      <div className="grid grid-2" style={{ marginTop: 20, alignItems: "flex-start" }}>
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 4 }}>🧾 History</h3>
          {rows.length === 0 ? (
            <div className="empty" style={{ marginTop: 12 }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>🧾</div>
              <div style={{ fontWeight: 700, color: "var(--t2)", fontSize: 13.5 }}>No requests yet</div>
              <div style={{ fontSize: 12.5, marginTop: 4 }}>Send <span className="mono">POST /api/v1/delete-user</span> and results land here.</div>
            </div>
          ) : (
            <table className="table" style={{ marginTop: 8 }}>
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
                  <tr key={r.id} style={{ cursor: "pointer", background: selected === r.id ? "var(--lime-10)" : undefined }} onClick={() => openAudit(r.id)}>
                    <td className="mono" style={{ fontSize: 12.5 }}>{r.subject_email}</td>
                    <td>
                      <span className={`badge ${badgeClass(r.status)}`}>
                        <span className="dot" />{r.status}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {new Date(r.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-sm">Detail</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card" style={{ position: "sticky", top: 24 }}>
          <h3 style={{ fontSize: 15 }}>🔍 Audit detail</h3>
          {!selected && <div className="empty" style={{ marginTop: 12 }}><div style={{ fontSize: 13 }}>Select a request to see per-integration results, timings and errors.</div></div>}
          {selected && loadingAudit && <p style={{ marginTop: 8 }}>Loading…</p>}
          {selected && !loadingAudit && (
            <div style={{ marginTop: 12 }}>
              {audit.length === 0 && <p className="dim" style={{ fontSize: 13 }}>No audit rows for this request.</p>}
              {audit.map((a, i) => (
                <div
                  key={i}
                  style={{
                    borderLeft: `2px solid ${
                      a.status === "success" ? "var(--emerald)" : a.status === "failed" ? "var(--rose)" : "var(--amber)"
                    }`,
                    background: "var(--s2)",
                    borderRadius: "0 10px 10px 0",
                    padding: "10px 12px",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{a.integration}</div>
                    <span className={`badge ${badgeClass(a.status)}`}>{a.status}</span>
                  </div>
                  <div className="dim" style={{ fontSize: 12.5, marginTop: 4 }}>{a.message}</div>
                  {typeof a.duration_ms === "number" && (
                    <div className="mono" style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>{a.duration_ms}ms</div>
                  )}
                  {a.error_detail && (
                    <div className="mono" style={{ fontSize: 11, color: "var(--rose)", marginTop: 4, wordBreak: "break-word" }}>
                      {a.error_detail}
                    </div>
                  )}
                </div>
              ))}
              <a className="btn btn-sm btn-ghost" href={`/api/requests/${selected}/pdf`} style={{ marginTop: 4 }}>
                📄 Download signed PDF
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

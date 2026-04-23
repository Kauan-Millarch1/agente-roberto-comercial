/**
 * Client-side API helpers.
 * All data fetching goes through server-side API routes
 * that use the service_role key securely.
 */

export async function fetchDashboardData() {
  const res = await fetch("/api/dashboard");
  if (!res.ok) throw new Error("Failed to fetch dashboard data");
  return res.json();
}

export async function fetchLeads() {
  const res = await fetch("/api/leads");
  if (!res.ok) throw new Error("Failed to fetch leads");
  return res.json();
}

export async function fetchMessages(phone: string) {
  const res = await fetch(`/api/messages?phone=${encodeURIComponent(phone)}`);
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

export async function fetchPerformance() {
  const res = await fetch("/api/performance");
  if (!res.ok) throw new Error("Failed to fetch performance data");
  return res.json();
}

export async function fetchCosts() {
  const res = await fetch("/api/costs");
  if (!res.ok) throw new Error("Failed to fetch costs data");
  return res.json();
}

export async function toggleHumanTakeover(
  phone: string,
  takeover: boolean,
  operator?: string
) {
  const res = await fetch("/api/leads", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, human_takeover: takeover, operator }),
  });
  if (!res.ok) throw new Error("Failed to toggle human takeover");
  return res.json();
}

export async function updateLeadStatus(phone: string, status: string) {
  const res = await fetch("/api/leads", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, status }),
  });
  if (!res.ok) throw new Error("Failed to update lead status");
  return res.json();
}

export async function sendMessage(phone: string, content: string) {
  const res = await fetch("/api/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, content }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}

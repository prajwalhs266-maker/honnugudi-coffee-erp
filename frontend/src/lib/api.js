import axios from "axios";

export const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
  withCredentials: true,
});

export const fmtINR = (paise) =>
  paise == null ? "—" : "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtKG = (g) =>
  g == null ? "—" : (g / 1000).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " kg";

export const fmtRate = (paise) =>
  paise == null ? "—" : "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 }) + "/kg";

export const toPaise = (s) => Math.round(parseFloat(s || 0) * 100);
export const toGrams = (s) => Math.round(parseFloat(s || 0) * 1000);
export const today = () => new Date().toISOString().slice(0, 10);

export const errMsg = (e) => {
  const detail = e?.response?.data?.detail;
  if (detail == null) return e?.message || "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  return String(detail?.msg || detail);
};

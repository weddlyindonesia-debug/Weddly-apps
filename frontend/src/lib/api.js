import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

export const idr = (n) => {
  const num = Number(n || 0);
  return "Rp " + num.toLocaleString("id-ID");
};

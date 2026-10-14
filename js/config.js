const SLNA_IS_LOCAL = ["localhost", "127.0.0.1"].includes(window.location.hostname);

const SLNA_CONFIG = {
  API_BASE_URL: SLNA_IS_LOCAL
    ? "http://localhost:3000/api"
    : "https://slna-backend-production.up.railway.app/api"
};
